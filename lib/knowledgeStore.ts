export interface KnowledgeItem {
  id: string;
  filename: string;
  category: string;
  dateAdded: string;
  usageCount: number;
  content: string;
}

// In-memory store to prevent Vercel EROFS errors
export const knowledgeStore: KnowledgeItem[] = [
  {
    id: "lib-1",
    filename: "typescript_best_practices.txt",
    category: "TypeScript",
    dateAdded: new Date().toLocaleDateString(),
    usageCount: 14,
    content: "TypeScript Best Practices:\nAlways enable strict mode. Use standard interfaces for model contracts. Prioritize static analysis and keep utility functions pure."
  },
  {
    id: "lib-2",
    filename: "tailwind_styling.txt",
    category: "Tailwind",
    dateAdded: new Date().toLocaleDateString(),
    usageCount: 8,
    content: "Tailwind CSS Styling:\nPrefer utility classes over custom css. Style container padding matching or exceeding inner gap. Minimize border-radii values to a maximum of 16px."
  }
];

export function getKnowledgeItems() {
  return knowledgeStore;
}

export function addKnowledgeItem(item: KnowledgeItem) {
  knowledgeStore.push(item);
}
