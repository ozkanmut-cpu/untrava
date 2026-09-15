import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export function FoundationScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.brand}>UNTRAVA</Text>
        <Text style={styles.title}>Your change, at your pace.</Text>
        <Text style={styles.body}>A private foundation for understanding patterns and building lasting change.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { flex: 1, justifyContent: 'center', padding: 28, gap: 12 },
  brand: { fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  title: { fontSize: 30, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 25 },
});
