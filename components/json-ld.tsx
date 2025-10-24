// /components/json-ld.tsx
interface JsonLdProps {
  data: {
    '@context': string;
    '@type': string;
    [key: string]: unknown;
  };
}

export default function JsonLd({ data }: JsonLdProps) {
  // Validate JSON-LD structure
  if (!data['@context'] || !data['@type']) {
    console.warn('Invalid JSON-LD: @context and @type are required');
    return null;
  }

  try {
    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data, null, 2) }}
      />
    );
  } catch (error) {
    console.error('Error serializing JSON-LD:', error);
    return null;
  }
}