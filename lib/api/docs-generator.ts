import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

interface EndpointDoc {
  path: string;
  method: string;
  description: string;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  requestBody?: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
    }>;
  };
  responses: Record<string, {
    description: string;
    content?: any;
  }>;
}

interface ApiDoc {
  version: string;
  title: string;
  description: string;
  endpoints: EndpointDoc[];
}

export class ApiDocsGenerator {
  private static baseDir = process.cwd();
  private static docsPath = join(process.cwd(), 'docs', 'api');

  static async generate() {
    const apiRoutes = await glob('app/api/v1/**/*.ts');
    const docs: ApiDoc = {
      version: '1.0.0',
      title: 'MGZon API Documentation',
      description: 'API documentation for MGZon e-commerce platform',
      endpoints: [],
    };

    for (const route of apiRoutes) {
      const content = readFileSync(join(this.baseDir, route), 'utf-8');
      const endpoints = this.parseRouteFile(content, route);
      docs.endpoints.push(...endpoints);
    }

    this.writeDocumentation(docs);
  }

  private static parseRouteFile(content: string, filePath: string): EndpointDoc[] {
    const docs: EndpointDoc[] = [];
    const commentRegex = /\/\*\*\s*\n([^*]|\*[^/])*\*\//g;
    const matches = content.match(commentRegex) || [];

    matches.forEach((comment) => {
      const endpoint = this.parseComment(comment, filePath);
      if (endpoint) docs.push(endpoint);
    });

    return docs;
  }

  private static parseComment(comment: string, filePath: string): EndpointDoc | null {
    const lines = comment.split('\n').map(line => line.replace(/^\s*\* ?/, '').trim());
    let endpoint: Partial<EndpointDoc> = { responses: {} };
    let currentSection = '';

    for (const line of lines) {
      if (line.startsWith('@path')) {
        endpoint.path = line.replace('@path', '').trim();
      } else if (line.startsWith('@method')) {
        endpoint.method = line.replace('@method', '').trim();
      } else if (line.startsWith('@description')) {
        endpoint.description = line.replace('@description', '').trim();
      } else if (line.startsWith('@param')) {
        if (!endpoint.parameters) endpoint.parameters = [];
        const [, name, type, required, description] = line.match(/@param \{(\w+)\} (\w+) (required|optional) (.*)/) || [];
        if (name) {
          endpoint.parameters.push({ name, type, required: required === 'required', description });
        }
      } else if (line.startsWith('@requestBody')) {
        currentSection = 'requestBody';
        endpoint.requestBody = { type: 'object', properties: {} };
      } else if (line.startsWith('@response')) {
        const [, code, description] = line.match(/@response (\d+) (.*)/) || [];
        if (code) {
          endpoint.responses![code] = { description };
        }
      } else if (currentSection === 'requestBody' && line.startsWith('-')) {
        const [, name, type, required, description] = line.match(/-\s*(\w+): (\w+) (required|optional) (.*)/) || [];
        if (name) {
          endpoint.requestBody!.properties[name] = { type, description, required: required === 'required' };
        }
      }
    }

    return endpoint.path && endpoint.method ? endpoint as EndpointDoc : null;
  }

  private static writeDocumentation(docs: ApiDoc) {
    const markdown = this.generateMarkdown(docs);
    writeFileSync(join(this.docsPath, 'api-reference.md'), markdown);

    const openapi = this.generateOpenAPI(docs);
    writeFileSync(
      join(this.docsPath, 'openapi.json'),
      JSON.stringify(openapi, null, 2)
    );
  }

  private static generateMarkdown(docs: ApiDoc): string {
    let markdown = `# ${docs.title}\n\n${docs.description}\n\nVersion: ${docs.version}\n\n## Endpoints\n\n`;
    for (const endpoint of docs.endpoints) {
      markdown += `### ${endpoint.method} ${endpoint.path}\n\n${endpoint.description}\n\n`;
      if (endpoint.parameters) {
        markdown += `#### Parameters\n\n| Name | Type | Required | Description |\n|------|------|----------|-------------|\n`;
        for (const param of endpoint.parameters) {
          markdown += `| ${param.name} | ${param.type} | ${param.required} | ${param.description} |\n`;
        }
        markdown += '\n';
      }
      if (endpoint.requestBody) {
        markdown += `#### Request Body\n\n| Property | Type | Required | Description |\n|----------|------|----------|-------------|\n`;
        for (const [name, prop] of Object.entries(endpoint.requestBody.properties)) {
          markdown += `| ${name} | ${prop.type} | ${prop.required || false} | ${prop.description} |\n`;
        }
        markdown += '\n';
      }
      markdown += `#### Responses\n\n| Status | Description |\n|--------|-------------|\n`;
      for (const [code, response] of Object.entries(endpoint.responses)) {
        markdown += `| ${code} | ${response.description} |\n`;
      }
      markdown += '\n';
    }
    return markdown;
  }

  private static generateOpenAPI(docs: ApiDoc): object {
    return {
      openapi: '3.0.3',
      info: {
        title: docs.title,
        description: docs.description,
        version: docs.version,
      },
      paths: docs.endpoints.reduce((acc, endpoint) => {
        acc[endpoint.path] = {
          [endpoint.method.toLowerCase()]: {
            description: endpoint.description,
            parameters: endpoint.parameters?.map(param => ({
              name: param.name,
              in: 'query',
              required: param.required,
              schema: { type: param.type },
              description: param.description,
            })),
            requestBody: endpoint.requestBody ? {
              content: {
                'application/json': {
                  schema: {
                    type: endpoint.requestBody.type,
                    properties: Object.fromEntries(
                      Object.entries(endpoint.requestBody.properties).map(([name, prop]) => [
                        name,
                        { type: prop.type, description: prop.description },
                      ])
                    ),
                    required: Object.entries(endpoint.requestBody.properties)
                      .filter(([_, prop]) => prop.required)
                      .map(([name]) => name),
                  },
                },
              },
            } : undefined,
            responses: Object.fromEntries(
              Object.entries(endpoint.responses).map(([code, response]) => [
                code,
                { description: response.description },
              ])
            ),
          },
        };
        return acc;
      }, {}),
    };
  }
}