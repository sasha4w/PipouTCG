/**
 * Découpe une liste (déjà triée, groupée par set) en pages d'au plus
 * `pageSize` éléments, sans jamais mettre deux sets sur la même page.
 */
export function paginateBySet<T extends { setId: number }>(
  items: T[],
  pageSize: number,
): T[][] {
  const pages: T[][] = [];
  let current: T[] = [];
  items.forEach((item) => {
    const setChanged = current.length > 0 && current[0].setId !== item.setId;
    if (setChanged || current.length === pageSize) {
      pages.push(current);
      current = [];
    }
    current.push(item);
  });
  if (current.length > 0) pages.push(current);
  return pages;
}
