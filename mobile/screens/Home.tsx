import React from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { useProducts } from '../hooks/useProducts';
import { ProductCard } from '../components/ProductCard';
import { CategoryScroll } from '../components/CategoryScroll';
import { FeaturedSlider } from '../components/FeaturedSlider';
import { Loading } from '../components/Loading';
import { Error } from '../components/Error';

export default function Home() {
  const { products, categories, featured, loading, error, refetch } = useProducts();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (loading) return <Loading />;
  if (error) return <Error message={error} onRetry={refetch} />;

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <FeaturedSlider items={featured} />
      <CategoryScroll categories={categories} />
      
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {products.map((product) => (
            <View key={product.id} style={{ width: '50%', padding: 8 }}>
              <ProductCard product={product} />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}