export type TreeNode = {
  id: string;
  parentId: string | null;
  children: TreeNode[];
};

/** Builds a parent-child tree from a flat, already-filtered menu list. */
export function buildMenuTree<T extends TreeNode>(menus: T[]): T[] {
  const byId = new Map(menus.map((menu) => [menu.id, menu]));
  for (const menu of menus) menu.children = [];

  const roots: T[] = [];
  for (const menu of menus) {
    const parent = menu.parentId ? byId.get(menu.parentId) : undefined;
    if (parent) parent.children.push(menu);
    else roots.push(menu);
  }
  return roots;
}
