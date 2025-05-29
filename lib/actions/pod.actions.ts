type GetPODDesignsOptions = {
    page: number
  }
  
  export async function getPODDesigns(userId: string, options: GetPODDesignsOptions) {
    // محاكاة قاعدة بيانات
    const pageSize = 10
    const allDesigns = await fakeDatabaseFetch(userId)
  
    const paginatedDesigns = allDesigns.slice(
      (options.page - 1) * pageSize,
      options.page * pageSize
    )
  
    return {
      data: {
        designs: paginatedDesigns,
        totalPages: Math.ceil(allDesigns.length / pageSize),
      }
    }
  }
  
  // دالة وهمية لمحاكاة جلب التصاميم
  async function fakeDatabaseFetch(userId: string) {
    return Array.from({ length: 35 }, (_, i) => ({
      id: `${i + 1}`,
      title: `Design #${i + 1}`,
      imageUrl: `https://via.placeholder.com/150?text=Design+${i + 1}`,
      createdBy: userId,
    }))
  }
  