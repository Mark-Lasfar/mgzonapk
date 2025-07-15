export async function generateProductDescription(
    productName: string,
    category: string,
    features: string[],
    language: 'en' | 'ar' | 'es' | 'fr' = 'en',
    keywords: string[] = []
  ): Promise<string> {
    const templates = {
      en: [
        'Discover the {productName}, a premium {category} built for {useCase}. With {features}, it offers {benefit}. {keywords}',
        'Upgrade your {useCase} with the {productName}. This {category} delivers {features} for {benefit}. {keywords}',
        'Experience the {productName}, a {category} designed for {useCase}. Enjoy {features} and {benefit}. {keywords}',
      ],
      ar: [
        'اكتشف {productName}، وهو {category} ممتاز مصمم لـ {useCase}. مع {features}، يقدم {benefit}. {keywords}',
        'طور {useCase} مع {productName}. هذا {category} يوفر {features} لتحقيق {benefit}. {keywords}',
        'استمتع بـ {productName}، وهو {category} مصمم لـ {useCase}. يتميز بـ {features} و {benefit}. {keywords}',
      ],
      es: [
        'Descubre el {productName}, un {category} de alta calidad para {useCase}. Con {features}, ofrece {benefit}. {keywords}',
        'Mejora tu {useCase} con el {productName}. Este {category} proporciona {features} para {benefit}. {keywords}',
        'Vive la experiencia del {productName}, un {category} diseñado para {useCase}. Disfruta de {features} y {benefit}. {keywords}',
      ],
      fr: [
        'Découvrez le {productName}, un {category} haut de gamme conçu pour {useCase}. Avec {features}, il offre {benefit}. {keywords}',
        'Améliorez votre {useCase} avec le {productName}. Ce {category} propose {features} pour {benefit}. {keywords}',
        'Profitez du {productName}, un {category} créé pour {useCase}. Bénéficiez de {features} et de {benefit}. {keywords}',
      ],
    };
  
    const useCases = {
      electronics: { en: 'daily tech needs', ar: 'الاحتياجات التقنية اليومية', es: 'necesidades tecnológicas diarias', fr: 'besoins technologiques quotidiens' },
      clothing: { en: 'everyday style', ar: 'الأناقة اليومية', es: 'estilo diario', fr: 'style quotidien' },
      default: { en: 'everyday use', ar: 'الاستخدام اليومي', es: 'uso diario', fr: 'utilisation quotidienne' },
    };
  
    const benefits = {
      '2+': { en: 'exceptional performance and durability', ar: 'أداء استثنائي ومتانة', es: 'rendimiento y durabilidad excepcionales', fr: 'performance et durabilité exceptionnelles' },
      default: { en: 'reliable quality', ar: 'جودة موثوقة', es: 'calidad confiable', fr: 'qualité fiable' },
    };
  
    const useCase = useCases[category as keyof typeof useCases]?.[language] || useCases.default[language];
    const benefit = features.length > 2 ? benefits['2+'][language] : benefits.default[language];
    const template = templates[language][Math.floor(Math.random() * templates[language].length)];
  
    return template
      .replace('{productName}', productName)
      .replace('{category}', category)
      .replace('{useCase}', useCase)
      .replace('{features}', features.join(', '))
      .replace('{benefit}', benefit)
      .replace('{keywords}', keywords.length > 0 ? `Keywords: ${keywords.join(', ')}.` : '');
  }