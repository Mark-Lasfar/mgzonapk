import { NextRequest, NextResponse } from 'next/server';
import { readXMLFile, parseXML, validateXML } from '@/lib/utils/xml';
import { customLogger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  const requestId = uuidv4();
  
  try {
    if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, error: 'Only multipart/form-data allowed' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const action = formData.get('action') as string; // 'parse', 'validate'
    const requiredFields = formData.get('requiredFields') ? 
      JSON.parse(formData.get('requiredFields') as string) : [];

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // قراءة الملف
    const content = await readXMLFile(file);
    
    if (action === 'validate') {
      const result = validateXML(content, requiredFields);
      customLogger.info('XML validation completed', { 
        requestId, 
        valid: result.valid, 
        errors: result.errors.length,
        filename: file.name 
      });
      
      return NextResponse.json({
        success: true,
        action: 'validate',
        ...result,
        filename: file.name
      });
      
    } else if (action === 'parse') {
      const result = parseXML(content, {
        dateFields: ['date', 'createdAt', 'updatedAt'],
        numberFields: ['price', 'quantity', 'countInStock'],
        booleanFields: ['featured', 'isPublished'],
        currencyFields: ['currency'],
        arrayFields: ['images', 'tags', 'categories']
      });
      
      customLogger.info('XML parsed successfully', { 
        requestId, 
        items: result.length,
        filename: file.name 
      });
      
      return NextResponse.json({
        success: true,
        action: 'parse',
        data: result,
        filename: file.name,
        totalItems: result.length
      });
      
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "parse" or "validate"' },
        { status: 400 }
      );
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to process XML';
    customLogger.error('XML processing failed', { 
      requestId, 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined 
    });
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}