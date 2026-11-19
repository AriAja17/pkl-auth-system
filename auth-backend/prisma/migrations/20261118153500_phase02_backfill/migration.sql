-- Phase 02 / M2 — data migration (authorization switch)
--
-- DO NOT APPLY until the new backend authorization code is ready for the SAME
-- coordinated release. Old backend instances use article.read / user.manage and
-- write User.roleId; running them after M2 would 403 every protected route and
-- diverge from UserRole.
--
-- The entire migration is one DO block: it is atomic, and every failed assertion
-- aborts the whole statement. No ON CONFLICT DO UPDATE, overwrite, merge or delete
-- of colliding/unmapped permissions is ever performed — owner reconciliation is
-- mandatory. User."roleId", RolePermission."permissionsId" and Article are untouched.

DO $m2$
DECLARE
  m RECORD;
  seed_key TEXT;
  n INT;
BEGIN
  -- Fail closed 0: only the five approved legacy keys may exist at this point.
  SELECT count(*) INTO n FROM "Permission"
   WHERE key NOT IN ('article.create','article.delete','article.read','article.update','user.manage');
  IF n > 0 THEN
    RAISE EXCEPTION 'M2 aborted: % unexpected/unmapped permission key(s) present', n;
  END IF;

  -- Fail closed 1: each source must exist exactly once; each target must be free.
  FOR m IN
    SELECT * FROM (VALUES
      ('article.read',   'read:article'),
      ('article.create', 'create:article'),
      ('article.update', 'update:article'),
      ('article.delete', 'delete:article'),
      ('user.manage',    'manage:user')
    ) AS v(src, tgt)
  LOOP
    SELECT count(*) INTO n FROM "Permission" WHERE key = m.src;
    IF n <> 1 THEN
      RAISE EXCEPTION 'M2 aborted: source key % found % time(s), expected 1', m.src, n;
    END IF;
    SELECT count(*) INTO n FROM "Permission" WHERE key = m.tgt;
    IF n > 0 THEN
      RAISE EXCEPTION 'M2 aborted: target key % already exists (collision; owner reconciliation required)', m.tgt;
    END IF;
  END LOOP;

  -- Fail closed 2: the rename target must not already exist.
  SELECT count(*) INTO n FROM "Role" WHERE name = 'superadmin';
  IF n > 0 THEN
    RAISE EXCEPTION 'M2 aborted: role superadmin already exists';
  END IF;

  -- Fail closed 3: every seed key must be free.
  FOREACH seed_key IN ARRAY ARRAY[
    'read:user','create:user','update:user','delete:user',
    'read:role','create:role','update:role','delete:role',
    'read:permission','create:permission','update:permission','delete:permission',
    'read:menu','create:menu','update:menu','delete:menu',
    'read:delegation','create:delegation','delete:delegation',
    'read:audit','grant:admin'
  ]::text[]
  LOOP
    SELECT count(*) INTO n FROM "Permission" WHERE key = seed_key;
    IF n > 0 THEN
      RAISE EXCEPTION 'M2 aborted: seed key % already exists', seed_key;
    END IF;
  END LOOP;

  -- Step 1 — UserRole backfill from legacy roleId (legacy column is preserved).
  INSERT INTO "UserRole" ("userId", "roleId", "assignedAt")
  SELECT id, "roleId", now() FROM "User" WHERE "roleId" IS NOT NULL
  ON CONFLICT DO NOTHING;

  -- Step 2 — system role rename.
  UPDATE "Role" SET name = 'superadmin', "isSystem" = true WHERE name = 'Admin';

  -- Step 3 — explicit per-key mapping; no wildcard, no overwrite.
  UPDATE "Permission" SET key = 'read:article'   WHERE key = 'article.read';
  UPDATE "Permission" SET key = 'create:article' WHERE key = 'article.create';
  UPDATE "Permission" SET key = 'update:article' WHERE key = 'article.update';
  UPDATE "Permission" SET key = 'delete:article' WHERE key = 'article.delete';
  UPDATE "Permission" SET key = 'manage:user'    WHERE key = 'user.manage';

  SELECT count(*) INTO n FROM "Permission" WHERE key LIKE '%.%';
  IF n > 0 THEN
    RAISE EXCEPTION 'M2 aborted: % unmapped legacy dotted key(s) remain', n;
  END IF;

  -- Step 5 — seed the approved 21 additional permissions.
  INSERT INTO "Permission" (id, key)
  SELECT gen_random_uuid()::text, k
    FROM unnest(ARRAY[
      'read:user','create:user','update:user','delete:user',
      'read:role','create:role','update:role','delete:role',
      'read:permission','create:permission','update:permission','delete:permission',
      'read:menu','create:menu','update:menu','delete:menu',
      'read:delegation','create:delegation','delete:delegation',
      'read:audit','grant:admin'
    ]::text[]) AS t(k);

  -- Protected permissions — applied after the seed so grant:admin exists,
  -- and before granting all permissions to superadmin.
  UPDATE "Permission"
  SET "isProtected" = true
  WHERE key IN ('manage:user', 'grant:admin');

  -- Step 6 — grant every permission to superadmin without duplicating rows.
  INSERT INTO "RolePermission" ("roleId", "permissionsId")
  SELECT r.id, p.id
    FROM "Role" r CROSS JOIN "Permission" p
   WHERE r.name = 'superadmin'
  ON CONFLICT DO NOTHING;

  -- Final verification — any failure aborts the whole migration.
  SELECT count(*) INTO n FROM "Permission"
   WHERE key !~ '^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$';
  IF n > 0 THEN
    RAISE EXCEPTION 'M2 verification failed: % permission key(s) have invalid format', n;
  END IF;

  SELECT count(*) INTO n FROM "Permission";
  IF n <> 26 THEN
    RAISE EXCEPTION 'M2 verification failed: expected 26 permission rows, found %', n;
  END IF;

  SELECT count(*) INTO n FROM (SELECT lower(key) FROM "Permission" GROUP BY 1 HAVING count(*) > 1) d;
  IF n > 0 THEN
    RAISE EXCEPTION 'M2 verification failed: % duplicate permission key(s)', n;
  END IF;

  SELECT count(*) INTO n FROM "Role" WHERE name = 'superadmin' AND "isSystem" = true;
  IF n <> 1 THEN
    RAISE EXCEPTION 'M2 verification failed: superadmin role missing or isSystem not set';
  END IF;

  SELECT count(*) INTO n FROM "Permission"
   WHERE key IN ('manage:user','grant:admin') AND "isProtected" <> true;
  IF n > 0 THEN
    RAISE EXCEPTION 'M2 verification failed: % protected permission(s) not flagged', n;
  END IF;

  SELECT count(*) INTO n FROM "User" u
   WHERE u."roleId" IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM "UserRole" ur
        WHERE ur."userId" = u.id AND ur."roleId" = u."roleId"
     );
  IF n > 0 THEN
    RAISE EXCEPTION 'M2 verification failed: % user(s) missing UserRole backfill', n;
  END IF;

  SELECT (SELECT count(*) FROM "UserRole")
       - (SELECT count(*) FROM "User" WHERE "roleId" IS NOT NULL)
    INTO n;
  IF n <> 0 THEN
    RAISE EXCEPTION 'M2 verification failed: UserRole row count does not match legacy roleId count';
  END IF;

  SELECT count(*) INTO n FROM "Permission" p
   WHERE NOT EXISTS (
     SELECT 1 FROM "RolePermission" rp JOIN "Role" r ON r.id = rp."roleId"
      WHERE r.name = 'superadmin' AND rp."permissionsId" = p.id
   );
  IF n > 0 THEN
    RAISE EXCEPTION 'M2 verification failed: % permission(s) missing from superadmin', n;
  END IF;

  SELECT count(*) INTO n FROM "Article";
  IF n <> 1 THEN
    RAISE EXCEPTION 'M2 verification failed: Article count changed (% rows)', n;
  END IF;

  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'roleId';
  IF n <> 1 THEN
    RAISE EXCEPTION 'M2 verification failed: legacy User.roleId column missing';
  END IF;

  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'RolePermission' AND column_name = 'permissionsId';
  IF n <> 1 THEN
    RAISE EXCEPTION 'M2 verification failed: RolePermission.permissionsId column missing';
  END IF;

END
$m2$;
