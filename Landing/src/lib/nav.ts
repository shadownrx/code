import { getCollection } from 'astro:content';

export interface NavItem {
  title: string;
  href: string;
}

export interface NavSection {
  section: string;
  items: NavItem[];
}

export async function getSidebar(): Promise<NavSection[]> {
  const docs = await getCollection('docs');
  const guides = docs
    .filter((d) => d.data.section === 'Guías')
    .sort((a, b) => a.data.order - b.data.order)
    .map((d) => ({ title: d.data.title, href: `/docs/${d.slug}` }));

  return [
    { section: 'Empezar', items: [{ title: 'Introducción', href: '/' }] },
    { section: 'Guías', items: guides },
  ];
}
