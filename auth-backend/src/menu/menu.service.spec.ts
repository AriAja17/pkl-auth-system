import { BadRequestException } from '@nestjs/common';
import { MenuService } from './menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { Principal } from '../authorization/principal';
import { MENU_URL_PATTERN, PRIMEICON_PATTERN } from '../common/validation/rules';

const menuRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  name: 'Menu',
  url: null,
  icon: null,
  parentId: null,
  order: 0,
  description: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  permissions: [],
  ...overrides,
});

const actor = (): Principal => ({
  id: 'actor-1',
  email: 'admin@example.com',
  username: 'admin',
  isActive: true,
  roles: [],
  permissions: new Set(),
  capabilities: new Set(),
  isSystem: false,
  legacyRoleName: null,
  legacyPermissions: [],
});

describe('MenuService', () => {
  let prisma: any;
  let audit: any;
  let service: MenuService;

  beforeEach(() => {
    prisma = {
      menu: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: any) => menuRow({ ...data, permissions: [] })),
        update: jest.fn().mockImplementation(async () => menuRow()),
        delete: jest.fn().mockResolvedValue({}),
      },
      permission: { findMany: jest.fn().mockResolvedValue([]) },
      menuPermission: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(async (arg: any) =>
        Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
      ),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new MenuService(prisma as unknown as PrismaService, audit);
  });

  it('creates a menu with parent and permission mapping', async () => {
    prisma.menu.findUnique.mockResolvedValue(menuRow({ id: 'parent-1' }));
    prisma.permission.findMany.mockResolvedValue([{ id: 'p1' }]);
    const result = await service.create({
      name: 'Users',
      url: '/users',
      icon: 'pi pi-users',
      parentId: 'parent-1',
      permissionIds: ['p1'],
    });
    expect(prisma.menu.create.mock.calls[0][0].data.permissions.create).toEqual([
      { permission: { connect: { id: 'p1' } } },
    ]);
    expect(result.permissions).toEqual([]); // mock row has no permissions
  });

  it('builds a parent-child tree from a flat list', async () => {
    prisma.menu.findMany.mockResolvedValue([
      menuRow({ id: 'root', name: 'Root', parentId: null }),
      menuRow({ id: 'child', name: 'Child', parentId: 'root' }),
    ]);
    const result = await service.list({ page: 1, limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].children[0].id).toBe('child');
  });

  it('rejects a direct parent-child cycle', async () => {
    prisma.menu.findUnique.mockResolvedValue(menuRow({ id: 'm1', parentId: null }));
    await expect(service.update('m1', { parentId: 'm1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an indirect parent-child cycle', async () => {
    prisma.menu.findUnique.mockResolvedValue(menuRow({ id: 'm1', parentId: null }));
    prisma.menu.findMany.mockResolvedValue([
      { id: 'm2', parentId: 'm1' },
      { id: 'm3', parentId: 'm2' },
    ]);
    await expect(service.update('m1', { parentId: 'm3' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('delegates child handling to the database on delete', async () => {
    prisma.menu.findUnique.mockResolvedValue(menuRow());
    await service.remove('m1');
    expect(prisma.menu.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    expect(prisma.menu.update).not.toHaveBeenCalled();
  });

  it('replaces menu permissions transactionally', async () => {
    prisma.menu.findUnique.mockResolvedValue(menuRow());
    prisma.permission.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    await service.setPermissions('m1', { permissionIds: ['p1', 'p2'] });
    expect(prisma.menuPermission.deleteMany).toHaveBeenCalledWith({ where: { menuId: 'm1' } });
    expect(prisma.menuPermission.createMany).toHaveBeenCalledWith({
      data: [
        { menuId: 'm1', permissionId: 'p1' },
        { menuId: 'm1', permissionId: 'p2' },
      ],
    });
  });

  it('validates menu URLs and PrimeIcons', () => {
    expect(MENU_URL_PATTERN.test('/menus')).toBe(true);
    expect(MENU_URL_PATTERN.test('javascript:alert(1)')).toBe(false);
    expect(MENU_URL_PATTERN.test('//evil.example')).toBe(false);
    expect(PRIMEICON_PATTERN.test('pi pi-users')).toBe(true);
    expect(PRIMEICON_PATTERN.test('pi-list-fw pi-bars')).toBe(true);
    expect(PRIMEICON_PATTERN.test('not-an-icon')).toBe(false);
  });

  it('audits createMenu with the database menu id, not the name', async () => {
    prisma.menu.create.mockImplementation(async ({ data }: any) =>
      menuRow({ id: 'menu-generated-id', ...data, permissions: [] }),
    );

    await service.create({ name: 'Users' }, actor());

    const entry = audit.record.mock.calls[0][0];
    expect(entry.action).toBe('menu.create');
    expect(entry.resourceId).toBe('menu-generated-id');
    expect(entry.resourceId).not.toBe('Users');
    expect(entry.before).toBeNull();
    expect(entry.after).toMatchObject({
      id: 'menu-generated-id',
      name: 'Users',
      url: null,
      icon: null,
      parentId: null,
      order: 0,
      isActive: true,
      permissionIds: [],
    });
  });

  it('audits changed and unchanged fields on PATCH menu', async () => {
    prisma.menu.findUnique.mockResolvedValue(
      menuRow({
        name: 'Old Menu',
        url: '/old',
        icon: 'pi pi-users',
        parentId: 'parent-1',
        order: 2,
        description: 'Old description',
        isActive: false,
        permissions: [{ permission: { id: 'p1' } }, { permission: { id: 'p2' } }],
      }),
    );
    prisma.menu.findMany.mockResolvedValue([]);

    await service.update('m1', { name: 'New Menu', order: 5 }, actor());

    const entry = audit.record.mock.calls[0][0];
    expect(entry.before).toMatchObject({
      id: 'm1',
      name: 'Old Menu',
      url: '/old',
      icon: 'pi pi-users',
      parentId: 'parent-1',
      order: 2,
      description: 'Old description',
      isActive: false,
      permissionIds: ['p1', 'p2'],
    });
    expect(entry.after).toMatchObject({
      id: 'm1',
      name: 'New Menu',
      url: '/old',
      icon: 'pi pi-users',
      parentId: 'parent-1',
      order: 5,
      description: 'Old description',
      isActive: false,
      permissionIds: ['p1', 'p2'],
    });
  });

  it('audits previous and next permission ids on menu permission change', async () => {
    prisma.menu.findUnique.mockResolvedValue(
      menuRow({
        permissions: [{ permission: { id: 'p1' } }, { permission: { id: 'p2' } }],
      }),
    );
    prisma.permission.findMany.mockResolvedValue([{ id: 'p3' }]);

    await service.setPermissions('m1', { permissionIds: ['p3'] }, actor());

    const entry = audit.record.mock.calls[0][0];
    expect(entry.before).toEqual({ id: 'm1', permissionIds: ['p1', 'p2'] });
    expect(entry.after).toEqual({ id: 'm1', permissionIds: ['p3'] });
  });

  it('records explicit null url, icon and description in the PATCH menu audit', async () => {
    prisma.menu.findUnique.mockResolvedValue(
      menuRow({
        name: 'Keep Name',
        url: '/old',
        icon: 'pi pi-users',
        description: 'Old description',
      }),
    );
    prisma.menu.findMany.mockResolvedValue([]);

    await service.update(
      'm1',
      { url: null, icon: null, description: null } as any,
      actor(),
    );

    const entry = audit.record.mock.calls[0][0];
    expect(entry.before).toMatchObject({
      name: 'Keep Name',
      url: '/old',
      icon: 'pi pi-users',
      description: 'Old description',
    });
    expect(entry.after).toMatchObject({
      name: 'Keep Name',
      url: null,
      icon: null,
      description: null,
    });
  });

  it('deduplicates and sorts permission ids in the setPermissions audit snapshot', async () => {
    prisma.menu.findUnique.mockResolvedValue(menuRow());
    prisma.permission.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);

    await service.setPermissions('m1', { permissionIds: ['p2', 'p1', 'p2'] }, actor());

    const entry = audit.record.mock.calls[0][0];
    expect(entry.after.permissionIds).toEqual(['p1', 'p2']);
    expect(new Set(entry.after.permissionIds).size).toBe(entry.after.permissionIds.length);
  });
});
