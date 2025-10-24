import Header from '@/components/shared/header';
import Footer from '@/components/shared/footer';
import { Toaster } from 'react-hot-toast';
import { Chatbote } from '@/components/shared/Chatbote';

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 flex flex-col">
        {children}
        <Toaster position="top-right" />
        <Chatbote />
      </main>
      <Footer />
    </div>
  );
}