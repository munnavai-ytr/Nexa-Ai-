import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://playnexaai.vercel.app';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    // You can dynamically fetch routes from a database or CMS here
    // and map them to the MetadataRoute.Sitemap format
  ];
}
