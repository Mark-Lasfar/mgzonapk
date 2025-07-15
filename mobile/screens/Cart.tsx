import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useCart } from '../contexts/CartContext';
import { CartItem } from '../components/CartItem';
import { Button } from '../components/Button';
import { Text } from '../components/Text';
import { formatCurrency } from '../utils/format';

export default function Cart() {
  const { items, total, removeFromCart, updateQuantity } = useCart();
  const navigation = useNavigation();

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="cart-outline" size={64} color="#999" />
        <Text style={styles.emptyText}>Your cart is empty</Text>
        <Button
          title="Start Shopping"
          onPress={() => navigation.navigate('Home')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.itemList}>
        {items.map((item) => (
          <CartItem
            key={item.id}
            item={item}
            onRemove={() => removeFromCart(item.id)}
            onUpdateQuantity={(qty) => updateQuantity(item.id, qty)}
          />
        ))}
      </ScrollView>

      <View style={styles.summary}>
        <View style={styles.row}>
          <Text>Subtotal</Text>
          <Text>{formatCurrency(total)}</Text>
        </View>
        <View style={styles.row}>
          <Text>Shipping</Text>
          <Text>{formatCurrency(10)}</Text>
        </View>
        <View style={[styles.row, styles.total]}>
          <Text style={styles.totalText}>Total</Text>
          <Text style={styles.totalText}>{formatCurrency(total + 10)}</Text>
        </View>

        <Button
          title="Proceed to Checkout"
          onPress={() => navigation.navigate('Checkout')}
          style={styles.checkoutButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginVertical: 20,
  },
  itemList: {
    flex: 1,
  },
  summary: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  total: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  checkoutButton: {
    marginTop: 20,
  },
});