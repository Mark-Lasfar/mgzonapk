'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FooterDoce } from '@/components/shared/footerDoce';
import { Chatbote } from '@/components/shared/Chatbote';
import {
  BookOpen,
  Settings,
  Key,
  Lock,
  Truck,
  Workflow,
  AlertCircle,
  Code2,
  Users,
  Menu,
  X,
  LogIn,
  Megaphone,
  ChevronDown,
  Sparkles,
  Package,
  ShoppingCart,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import LanguageSwitcher from '@/components/shared/header/language-switcher';
import ThemeSwitcher from '@/components/shared/header/theme-switcher';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function OAuthDocsPage() {
  const t = useTranslations('Docs');
  const locale = useLocale();
  const router = useRouter();

  const [activeSection, setActiveSection] = useState('introduction');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  const sections = [
    {
      category: 'Overview',
      items: [
        { id: 'introduction', title: t('oauth.introduction'), icon: <BookOpen className="w-5 h-5" /> },
        { id: 'setup', title: t('oauth.setup'), icon: <Settings className="w-5 h-5" /> },
      ],
    },
    {
      category: 'Seller Tools',
      items: [
        { id: 'sellerSetup', title: t('oauth.sellerSetup'), icon: <Key className="w-5 h-5" /> },
        { id: 'sellerIntegrations', title: t('oauth.sellerIntegrations'), icon: <Truck className="w-5 h-5" /> },
      ],
    },
    {
      category: 'API Details',
      items: [
        { id: 'scopes', title: t('oauth.scopes.title'), icon: <Lock className="w-5 h-5" /> },
        { id: 'flow', title: t('oauth.flow'), icon: <Workflow className="w-5 h-5" /> },
        { id: 'endpoints', title: t('oauth.endpoints'), icon: <Link className="w-5 h-5" href={''} /> },
        { id: 'errors', title: t('oauth.errors'), icon: <AlertCircle className="w-5 h-5" /> },
      ],
    },
    {
      category: 'Examples & Ads',
      items: [
        { id: 'example', title: t('oauth.example'), icon: <Code2 className="w-5 h-5" /> },
        { id: 'advertising', title: t('oauth.advertising'), icon: <Megaphone className="w-5 h-5" /> },
        { id: 'developers', title: t('oauth.developers'), icon: <Users className="w-5 h-5" /> },
      ],
    },
  ];

  const toggleCategory = (category) => {
    setExpandedSections((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Floating elements for dynamic background
  const floatingElements = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 12 + Math.random() * 8,
    size: 24 + Math.random() * 32,
    icon: i % 3 === 0 ? Package : i % 3 === 1 ? ShoppingCart : Zap,
  }));

  // CodeBlock component with syntax highlighting and copy button
  const CodeBlock = ({ code, language = 'javascript' }: { code: string; language?: string }) => {
    const copyToClipboard = () => {
      navigator.clipboard.writeText(code).then(() => {
        toast.success(t('oauth.codeCopied'));
      });
    };

    return (
      <div className="relative my-4">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 bg-gray-700 text-white hover:bg-gray-600 z-10"
          onClick={copyToClipboard}
        >
          {t('oauth.copy')}
        </Button>
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            borderRadius: '0.5rem',
            padding: '1rem',
            backgroundColor: '#1e1e1e',
            fontSize: '0.9rem',
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  };

  const handleSectionClick = (id) => {
    setActiveSection(id);
    setIsSidebarOpen(false);
    const element = document.querySelector(`#${id}`);
    if (element) {
      const y = element.getBoundingClientRect().top + window.pageYOffset - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col min-h-screen relative bg-gradient-to-br from-background via-muted/20 to-primary/10 overflow-hidden">
      <style jsx global>{`
        :root {
          --font-sans: 'Poppins', sans-serif;
          --font-mono: 'Orbitron', monospace;
          --radius: 1rem;
        }

        :root.dark {
          --background: 220 70% 10%;
          --foreground: 0 0% 95%;
          --card: 220 70% 15%;
          --card-foreground: 0 0% 90%;
          --primary: 180 100% 50%;
          --primary-foreground: 0 0% 0%;
          --secondary: 260 80% 30%;
          --secondary-foreground: 0 0% 95%;
          --muted: 220 50% 20%;
          --muted-foreground: 0 0% 70%;
          --accent: 320 100% 60%;
          --accent-foreground: 0 0% 95%;
          --border: 220 50% 25%;
        }

        :root.light {
          --background: 0 0% 100%;
          --foreground: 220 70% 10%;
          --card: 0 0% 95%;
          --card-foreground: 220 70% 15%;
          --primary: 180 100% 50%;
          --primary-foreground: 0 0% 100%;
          --secondary: 260 80% 40%;
          --secondary-foreground: 0 0% 10%;
          --muted: 0 0% 90%;
          --muted-foreground: 0 0% 40%;
          --accent: 320 100% 50%;
          --accent-foreground: 0 0% 10%;
          --border: 0 0% 80%;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: var(--font-sans);
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          line-height: 1.6;
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
        }

        #particles-js {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: -1;
        }

        .container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 2rem;
        }

        .glass {
          background: rgba(255, 255, 255, 0.07);
          border-radius: var(--radius);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: all 0.3s ease;
        }

        .glass:hover {
          transform: scale(1.05);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
          background: rgba(255, 255, 255, 0.15);
        }

        .nav-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 30;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          padding: 1rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        [dir="rtl"] .nav-bar .logo {
          order: 1;
        }

        [dir="rtl"] .nav-bar .controls {
          order: 0;
        }

        .sidebar {
          position: fixed;
          top: 80px;
          width: 280px;
          height: calc(100vh - 80px);
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(12px);
          border-radius: var(--radius);
          transition: transform 0.3s ease;
          z-index: 20;
        }

        [dir="ltr"] .sidebar {
          left: 0;
          transform: translateX(-100%);
        }

        [dir="rtl"] .sidebar {
          right: 0;
          transform: translateX(100%);
        }

        .sidebar.open {
          transform: translateX(0);
        }

        .main-content {
          margin-top: 80px;
          transition: margin 0.3s ease;
        }

        [dir="ltr"] .main-content {
          margin-left: 0;
        }

        [dir="rtl"] .main-content {
          margin-right: 0;
        }

        @media (min-width: 768px) {
          [dir="ltr"] .sidebar {
            transform: translateX(0);
            position: sticky;
            top: 80px;
            height: calc(100vh - 80px);
          }

          [dir="rtl"] .sidebar {
            transform: translateX(0);
            position: sticky;
            top: 80px;
            height: calc(100vh - 80px);
          }

          [dir="ltr"] .main-content {
            margin-left: 300px;
          }

          [dir="rtl"] .main-content {
            margin-right: 300px;
          }
        }

        @media (max-width: 767px) {
          .sidebar {
            width: 80%;
            max-width: 280px;
            height: calc(100vh - 80px);
          }

          .main-content {
            margin-left: 0 !important;
            margin-right: 0 !important;
          }

          .container {
            padding: 0 1.5rem;
          }
        }

        /* Enhanced Background with Subtle Animations */
        .bg-enhanced {
          position: fixed;
          inset: 0;
          opacity: 25;
        }

        .radial-gradient-1 {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 30% 70%, rgba(120,119,198,0.3), transparent 60%);
          animation: pulse-slow 10s infinite cubic-bezier(0.4, 0, 0.6, 1);
        }

        .radial-gradient-2 {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 70% 30%, rgba(255,119,198,0.3), transparent 60%);
          animation: pulse-delayed 12s infinite cubic-bezier(0.4, 0, 0.6, 1);
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.5; }
        }

        @keyframes pulse-delayed {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.4; }
        }

        /* Floating Elements */
        .floating-element {
          position: fixed;
          color: hsl(var(--primary) / 0.2);
          pointer-events: none;
        }

        /* Fix zoom and top issues */
        section {
          transform: scale(1) !important;
          zoom: 1 !important;
          padding-top: 0 !important;
          margin-top: 0 !important;
        }

        .card-content {
          padding: 1.5rem;
          overflow: hidden;
          zoom: 1;
        }

        .scroll-area {
          overflow-y: auto;
          zoom: 1;
        }
      `}</style>

      {/* Enhanced Background */}
      <div className="bg-enhanced">
        <div className="radial-gradient-1"></div>
        <div className="radial-gradient-2"></div>
      </div>

      {/* Floating Elements */}
      {floatingElements.map((el) => (
        <motion.div
          key={el.id}
          className="floating-element"
          style={{
            left: `${el.x}vw`,
            top: `${el.y}vh`,
            fontSize: `${el.size}px`,
          }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{
            opacity: [0.2, 0.7, 0.2],
            y: [-15, 15, -15],
            scale: [0.9, 1.1, 0.9],
            rotate: [0, 360],
          }}
          transition={{
            duration: el.duration,
            delay: el.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {React.createElement(el.icon, { className: 'w-full h-full' })}
        </motion.div>
      ))}

      {/* Navigation Bar */}
      <nav className="nav-bar glass">
        <div className="logo">
          <Link href={process.env.NEXT_PUBLIC_BASE_URL || '/'}>
            <Image
              src="https://raw.githubusercontent.com/Mark-Lasfar/MGZon/9a1b2149507ae61fec3bb7fb86d8d16c11852f3b/public/icons/mg.svg"
              width={50}
              height={50}
              alt="MGZon logo"
              className="rounded-full"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </Link>
        </div>
        <div className="controls flex items-center space-x-4">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </nav>

      <div className="container mx-auto py-10 px-4 flex-grow">
        {/* Hamburger Menu for Mobile */}
        <div className="md:hidden flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{t('oauth.title')}</h1>
          <Button
            variant="ghost"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-[hsl(var(--foreground))]"
          >
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>

        {/* Sidebar */}
        <aside
          className={cn(
            'sidebar glass',
            isSidebarOpen && 'open'
          )}
        >
          <ScrollArea className="h-full p-4 scroll-area">
            <h2 className="text-lg font-semibold mb-4 text-[hsl(var(--foreground))]">
              {t('oauth.navigation')}
            </h2>
            {sections.map((category) => (
              <div key={category.category} className="mb-4">
                <Button
                  variant="ghost"
                  className="w-full flex justify-between items-center text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-accent/10 rounded-lg py-2 px-3"
                  onClick={() => toggleCategory(category.category)}
                >
                  <span>{category.category}</span>
                  <motion.div
                    animate={{ rotate: expandedSections[category.category] ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </Button>
                <AnimatePresence>
                  {expandedSections[category.category] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="ml-4 mt-2 space-y-2"
                    >
                      {category.items.map((section) => (
                        <Button
                          key={section.id}
                          variant={activeSection === section.id ? 'default' : 'ghost'}
                          className={cn(
                            'w-full justify-start rounded-lg py-2 px-3 text-sm transition-all duration-200 hover:bg-accent/20',
                            activeSection === section.id && 'bg-primary/90 text-primary-foreground hover:bg-primary'
                          )}
                          onClick={() => handleSectionClick(section.id)}
                        >
                          <div className="flex items-center gap-3">
                            <motion.div
                              animate={{ scale: activeSection === section.id ? 1.1 : 1 }}
                              transition={{ duration: 0.2 }}
                            >
                              {section.icon}
                            </motion.div>
                            <span>{section.title}</span>
                          </div>
                        </Button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
            <Button
              variant="outline"
              className="w-full mt-4 flex items-center space-x-2 text-[hsl(var(--foreground))] border-[hsl(var(--border))]"
              onClick={() => router.push(`${process.env.NEXT_PUBLIC_BASE_URL}/auth/login`)}
            >
              <LogIn className="w-5 h-5" />
              <span>{t('login')}</span>
            </Button>
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <main className="main-content flex-grow space-y-8">
          <h1 className="hidden md:block text-4xl font-bold mb-6 text-[hsl(var(--foreground))]">
            {t('oauth.title')}
          </h1>

          {activeSection === 'introduction' && (
            <section id="introduction" className="scroll-mt-28">
              <Card className="mb-8 glass">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <Image
                      src="https://raw.githubusercontent.com/Mark-Lasfar/MGZon/9a1b2149507ae61fec3bb7fb86d8d16c11852f3b/public/icons/mg.svg"
                      alt="MGZon Logo"
                      width={80}
                      height={80}
                      className="object-contain"
                    />
                    <CardTitle>{t('oauth.introduction')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="card-content">
                  <p className="mb-4">{t('introductionDesc')}</p>
                  <p>{t('oauth.introductionDetails')}</p>
                </CardContent>
              </Card>
            </section>
          )}

          {activeSection === 'setup' && (
            <section id="setup" className="scroll-mt-28">
              <Card className="mb-8 glass">
                <CardHeader>
                  <CardTitle>{t('oauth.setup')}</CardTitle>
                </CardHeader>
                <CardContent className="card-content">
                  <p className="mb-4">{t('oauth.setupDesc')}</p>
                  <ol className="list-decimal pl-5 mb-4">
                    <li>{t('oauth.step1')}</li>
                    <li>{t('oauth.step2')}</li>
                    <li>{t('oauth.step3')}</li>
                    <li>{t('oauth.step4')}</li>
                  </ol>
                  <h3 className="text-lg font-semibold mb-2">{t('oauth.setupExample')}</h3>
                  <CodeBlock
                    code={`// Example: Registering an OAuth application
curl -X POST ${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/clients \\
-H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
-H "Content-Type: application/json" \\
-d '{
  "name": "MyApp",
  "redirectUris": ["https://your-app.com/callback"],
  "scopes": ["profile:read", "products:write"]
}'`}
                  />
                  <p className="mt-2">{t('oauth.setupResponse')}</p>
                  <CodeBlock
                    code={`{
  "success": true,
  "data": {
    "clientId": "YOUR_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET",
    "name": "MyApp",
    "redirectUris": ["https://your-app.com/callback"],
    "scopes": ["profile:read", "products:write"],
    "createdAt": "2025-08-18T10:31:00.000Z"
  }
}`}
                    language="json"
                  />
                </CardContent>
              </Card>
            </section>
          )}

          {activeSection === 'sellerSetup' && (
            <section id="sellerSetup" className="scroll-mt-28">
              <Card className="mb-8 glass">
                <CardHeader>
                  <CardTitle>{t('oauth.sellerSetup')}</CardTitle>
                </CardHeader>
                <CardContent className="card-content">
                  <p className="mb-4">{t('oauth.sellerSetupDesc')}</p>
                  <ol className="list-decimal pl-5 mb-4">
                    <li>{t('oauth.sellerStep1')}</li>
                    <li>{t('oauth.sellerStep2')}</li>
                    <li>{t('oauth.sellerStep3')}</li>
                    <li>{t('oauth.sellerStep4')}</li>
                  </ol>
                  <h3 className="text-lg font-semibold mb-2">{t('oauth.sellerApiKeyExample')}</h3>
                  <CodeBlock
                    code={`POST ${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/keys
Content-Type: application/json
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "name": "My Seller API Key",
  "permissions": ["products:read", "products:write", "inventory:read", "inventory:write"]
}`}
                  />
                  <p className="mt-2">{t('oauth.sellerApiKeyResponse')}</p>
                  <CodeBlock
                    code={`{
  "success": true,
  "data": {
    "key": "YOUR_API_KEY",
    "name": "My Seller API Key",
    "permissions": ["products:read", "products:write", "inventory:read", "inventory:write"],
    "createdAt": "2025-08-18T10:31:00.000Z"
  },
  "requestId": "REQUEST_ID",
  "timestamp": "2025-08-18T10:31:00.000Z"
}`}
                    language="json"
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.sellerApiKeyJs')}</h3>
                  <CodeBlock
                    code={`const fetch = require('node-fetch');

async function createApiKey(token, name, permissions) {
  const response = await fetch('${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/keys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${token}\`
    },
    body: JSON.stringify({ name, permissions })
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
}

createApiKey('YOUR_ACCESS_TOKEN', 'My Seller API Key', ['products:read', 'products:write'])
  .then(data => console.log('API Key:', data.key))
  .catch(err => console.error('Error:', err.message));`}
                  />
                </CardContent>
              </Card>
            </section>
          )}

          {activeSection === 'scopes' && (
            <section id="scopes" className="scroll-mt-28">
              <Card className="mb-8 glass">
                <CardHeader>
                  <CardTitle>{t('oauth.scopes.title')}</CardTitle>
                </CardHeader>
                <CardContent className="card-content">
                  <p className="mb-4">{t('oauth.scopes.description')}</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('oauth.scope')}</TableHead>
                        <TableHead>{t('oauth.description')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>profile:read</TableCell>
                        <TableCell>{t('oauth.scopes.profileRead')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>profile:write</TableCell>
                        <TableCell>{t('oauth.scopes.profileWrite')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>products:read</TableCell>
                        <TableCell>{t('oauth.scopes.productsRead')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>products:write</TableCell>
                        <TableCell>{t('oauth.scopes.productsWrite')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>orders:read</TableCell>
                        <TableCell>{t('oauth.scopes.ordersRead')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>orders:write</TableCell>
                        <TableCell>{t('oauth.scopes.ordersWrite')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>customers:read</TableCell>
                        <TableCell>{t('oauth.scopes.customersRead')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>customers:write</TableCell>
                        <TableCell>{t('oauth.scopes.customersWrite')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>inventory:read</TableCell>
                        <TableCell>{t('oauth.scopes.inventoryRead')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>inventory:write</TableCell>
                        <TableCell>{t('oauth.scopes.inventoryWrite')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>analytics:read</TableCell>
                        <TableCell>{t('oauth.scopes.analyticsRead')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>ads:read</TableCell>
                        <TableCell>{t('oauth.scopes.adsRead')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>ads:write</TableCell>
                        <TableCell>{t('oauth.scopes.adsWrite')}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.scopesExample')}</h3>
                  <CodeBlock
                    code={`// Example: Requesting scopes in Node.js
const authUrl = \`${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/mgz?client_id=\${clientId}&redirect_uri=\${redirectUri}&scope=profile:read%20products:write%20ads:write&state=STATE\`;
res.redirect(authUrl);`}
                  />
                </CardContent>
              </Card>
            </section>
          )}

          {activeSection === 'sellerIntegrations' && (
            <section id="sellerIntegrations" className="scroll-mt-28">
              <Card className="mb-8 glass">
                <CardHeader>
                  <CardTitle>{t('oauth.sellerIntegrations')}</CardTitle>
                </CardHeader>
                <CardContent className="card-content">
                  <p className="mb-4">{t('oauth.sellerIntegrationsDesc')}</p>
                  <h3 className="text-lg font-semibold mb-2">{t('oauth.importProducts')}</h3>
                  <p>{t('oauth.importProductsDesc')}</p>
                  <CodeBlock
                    code={`POST ${process.env.NEXT_PUBLIC_BASE_URL}/api/products/import
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "provider": "shopify",
  "productId": "SHOPIFY_PRODUCT_ID",
  "sellerId": "YOUR_SELLER_ID",
  "region": "us"
}`}
                  />
                  <p className="mt-2">{t('oauth.importProductsResponse')}</p>
                  <CodeBlock
                    code={`{
  "success": true,
  "data": [
    {
      "_id": "PRODUCT_ID",
      "title": "Product Name",
      "description": "Product Description",
      "price": 29.99,
      "sku": "SKU123",
      "quantity": 100,
      "currency": "USD",
      "region": "us",
      "sellerId": "YOUR_SELLER_ID",
      "source": "shopify",
      "sourceId": "SHOPIFY_PRODUCT_ID"
    }
  ],
  "requestId": "REQUEST_ID",
  "timestamp": "2025-08-18T10:31:00.000Z"
}`}
                    language="json"
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.exportProducts')}</h3>
                  <p>{t('oauth.exportProductsDesc')}</p>
                  <CodeBlock
                    code={`POST ${process.env.NEXT_PUBLIC_BASE_URL}/api/products/export
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "productId": "PRODUCT_ID",
  "targetPlatform": "shipbob",
  "sellerId": "YOUR_SELLER_ID",
  "region": "us"
}`}
                  />
                  <p className="mt-2">{t('oauth.exportProductsResponse')}</p>
                  <CodeBlock
                    code={`{
  "success": true,
  "data": {
    "productId": "PRODUCT_ID",
    "targetPlatform": "shipbob",
    "shipbobProductId": "SHIPBOB_PRODUCT_ID",
    "exportedAt": "2025-08-18T10:31:00.000Z"
  },
  "requestId": "REQUEST_ID",
  "timestamp": "2025-08-18T10:31:00.000Z"
}`}
                    language="json"
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.syncInventory')}</h3>
                  <p>{t('oauth.syncInventoryDesc')}</p>
                  <CodeBlock
                    code={`POST ${process.env.NEXT_PUBLIC_BASE_URL}/api/products/sync
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "productId": "PRODUCT_ID",
  "provider": "shopify",
  "sellerId": "YOUR_SELLER_ID",
  "region": "us"
}`}
                  />
                  <p className="mt-2">{t('oauth.syncInventoryResponse')}</p>
                  <CodeBlock
                    code={`{
  "success": true,
  "data": {
    "productId": "PRODUCT_ID",
    "provider": "shopify",
    "quantity": 100,
    "syncedAt": "2025-08-18T10:31:00.000Z"
  },
  "requestId": "REQUEST_ID",
  "timestamp": "2025-08-18T10:31:00.000Z"
}`}
                    language="json"
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.sellerIntegrationsJs')}</h3>
                  <CodeBlock
                    code={`const fetch = require('node-fetch');

async function syncInventory(apiKey, sellerId, productId, provider) {
  const response = await fetch('${process.env.NEXT_PUBLIC_BASE_URL}/api/products/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${apiKey}\`
    },
    body: JSON.stringify({ productId, provider, sellerId, region: 'us' })
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error);
  }
  console.log('Inventory synced:', result.data);
}

syncInventory('YOUR_API_KEY', 'YOUR_SELLER_ID', 'PRODUCT_ID', 'shopify')
  .catch(err => console.error('Sync failed:', err.message));`}
                  />
                </CardContent>
              </Card>
            </section>
          )}

          {activeSection === 'flow' && (
            <section id="flow" className="scroll-mt-28">
              <Card className="mb-8 glass">
                <CardHeader>
                  <CardTitle>{t('oauth.flow')}</CardTitle>
                </CardHeader>
                <CardContent className="card-content">
                  <p className="mb-4">{t('oauth.flowDesc')}</p>
                  <ol className="list-decimal pl-5 mb-4">
                    <li>{t('oauth.flowStep1')}</li>
                    <li>{t('oauth.flowStep2')}</li>
                    <li>{t('oauth.flowStep3')}</li>
                    <li>{t('oauth.flowStep4')}</li>
                    <li>{t('oauth.flowStep5')}</li>
                  </ol>
                  <h3 className="text-lg font-semibold mb-2">{t('oauth.flowExample')}</h3>
                  <CodeBlock
                    code={`// Example: OAuth flow in Node.js
const express = require('express');
const app = express();

app.get('/auth/mgz', (req, res) => {
  const authUrl = \`${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/mgz?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&scope=profile:read%20products:write&state=STATE\`;
  res.redirect(authUrl);
});

app.get('/auth/mgz/callback', async (req, res) => {
  const code = req.query.code;
  const tokenResponse = await fetch('${process.env.NEXT_PUBLIC_BASE_URL}/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: 'YOUR_CLIENT_ID',
      client_secret: 'YOUR_CLIENT_SECRET',
      redirect_uri: 'YOUR_REDIRECT_URI'
    })
  });
  const tokenData = await tokenResponse.json();
  res.json(tokenData);
});

app.listen(3000);`}
                  />
                </CardContent>
              </Card>
            </section>
          )}

          {activeSection === 'endpoints' && (
            <section id="endpoints" className="scroll-mt-28">
              <Card className="mb-8 glass">
                <CardHeader>
                  <CardTitle>{t('oauth.endpoints')}</CardTitle>
                </CardHeader>
                <CardContent className="card-content">
                  <h3 className="text-lg font-semibold mb-2">{t('oauth.authEndpoint')}</h3>
                  <p>{t('oauth.authEndpointDesc')}</p>
                  <CodeBlock
                    code={`GET ${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/mgz?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&scope=profile:read%20products:write&state=STATE`}
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.tokenEndpoint')}</h3>
                  <p>{t('oauth.tokenEndpointDesc')}</p>
                  <CodeBlock
                    code={`POST ${process.env.NEXT_PUBLIC_BASE_URL}/api/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "AUTH_CODE",
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "redirect_uri": "YOUR_REDIRECT_URI"
}`}
                  />
                  <p className="mt-2">{t('oauth.tokenResponse')}</p>
                  <CodeBlock
                    code={`{
  "access_token": "ACCESS_TOKEN",
  "refresh_token": "REFRESH_TOKEN",
  "expires_in": 3600,
  "token_type": "Bearer",
  "scope": "profile:read products:write"
}`}
                    language="json"
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.userinfoEndpoint')}</h3>
                  <p>{t('oauth.userinfoEndpointDesc')}</p>
                  <CodeBlock
                    code={`GET ${process.env.NEXT_PUBLIC_BASE_URL}/api/userinfo
Authorization: Bearer ACCESS_TOKEN`}
                  />
                  <p className="mt-2">{t('oauth.userinfoResponse')}</p>
                  <CodeBlock
                    code={`{
  "sub": "USER_ID",
  "email": "user@example.com",
  "name": "User Name",
  "nickname": "user_nickname",
  "sellerId": "SELLER_ID"
}`}
                    language="json"
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.refreshToken')}</h3>
                  <p>{t('oauth.refreshTokenDesc')}</p>
                  <CodeBlock
                    code={`POST ${process.env.NEXT_PUBLIC_BASE_URL}/api/token
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "refresh_token": "REFRESH_TOKEN",
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET"
}`}
                  />
                  <p className="mt-2">{t('oauth.refreshTokenResponse')}</p>
                  <CodeBlock
                    code={`{
  "access_token": "NEW_ACCESS_TOKEN",
  "refresh_token": "NEW_REFRESH_TOKEN",
  "expires_in": 3600,
  "token_type": "Bearer",
  "scope": "profile:read products:write"
}`}
                    language="json"
                  />
                </CardContent>
              </Card>
            </section>
          )}

          {activeSection === 'errors' && (
            <section id="errors" className="scroll-mt-28">
              <Card className="mb-8 glass">
                <CardHeader>
                  <CardTitle>{t('oauth.errors')}</CardTitle>
                </CardHeader>
                <CardContent className="card-content">
                  <p className="mb-4">{t('oauth.errorsDesc')}</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('oauth.errorCode')}</TableHead>
                        <TableHead>{t('oauth.description')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>invalid_request</TableCell>
                        <TableCell>{t('oauth.errors.invalidRequest')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>invalid_client</TableCell>
                        <TableCell>{t('oauth.errors.invalidClient')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>invalid_grant</TableCell>
                        <TableCell>{t('oauth.errors.invalidGrant')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>unauthorized_client</TableCell>
                        <TableCell>{t('oauth.errors.unauthorizedClient')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>unsupported_grant_type</TableCell>
                        <TableCell>{t('oauth.errors.unsupportedGrantType')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>integration_not_found</TableCell>
                        <TableCell>{t('oauth.errors.integrationNotFound')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>integration_not_connected</TableCell>
                        <TableCell>{t('oauth.errors.integrationNotConnected')}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.errorsExample')}</h3>
                  <CodeBlock
                    code={`// Example: Handling errors in Node.js
const fetch = require('node-fetch');

async function fetchUserInfo(accessToken) {
  try {
    const response = await fetch('${process.env.NEXT_PUBLIC_BASE_URL}/api/userinfo', {
      headers: { Authorization: \`Bearer \${accessToken}\` }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Unknown error');
    }
    console.log('User info:', data);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.message === 'invalid_request') {
      console.log('Fix your request parameters.');
    }
  }
}

fetchUserInfo('INVALID_TOKEN');`}
                  />
                </CardContent>
              </Card>
            </section>
          )}

          {activeSection === 'advertising' && (
            <section id="advertising" className="scroll-mt-28">
              <Card className="mb-8 glass">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Megaphone className="w-6 h-6" />
                    <CardTitle>{t('oauth.advertising')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="card-content">
                  <p className="mb-4">{t('oauth.advertisingDesc')}</p>
                  <p className="mb-4">
                    {t('oauth.advertisingGetStarted')}{' '}
                    <Link href={`${process.env.NEXT_PUBLIC_BASE_URL}/account/ads`} className="text-[hsl(var(--primary))] hover:underline">
                      {t('oauth.advertisementsLink')}
                    </Link>
                  </p>
                  <h3 className="text-lg font-semibold mb-2">{t('oauth.createAdCampaign')}</h3>
                  <p className="mb-2">{t('oauth.createAdCampaignDesc')}</p>
                  <CodeBlock
                    code={`POST ${process.env.NEXT_PUBLIC_BASE_URL}/api/seller/ads?sandbox=false
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "integrationId": "INTEGRATION_ID",
  "name": "Summer Sale Campaign",
  "budget": { "amount": 1000, "currency": "USD" },
  "schedule": { 
    "startDate": "2025-08-18T10:00:00.000Z",
    "endDate": "2025-09-18T10:00:00.000Z"
  },
  "creatives": [
    { 
      "type": "image", 
      "url": "https://example.com/ad.jpg",
      "dimensions": { "width": 1200, "height": 600 }
    }
  ],
  "products": ["PRODUCT_ID_1", "PRODUCT_ID_2"],
  "targeting": {
    "regions": ["us", "eu"],
    "demographics": { "age": "18-45", "gender": "all" }
  }
}`}
                  />
                  <p className="mt-2">{t('oauth.createAdCampaignResponse')}</p>
                  <CodeBlock
                    code={`{
  "success": true,
  "data": {
    "_id": "CAMPAIGN_ID",
    "integrationId": "INTEGRATION_ID",
    "name": "Summer Sale Campaign",
    "budget": { "amount": 1000, "currency": "USD" },
    "schedule": { 
      "startDate": "2025-08-18T10:00:00.000Z",
      "endDate": "2025-09-18T10:00:00.000Z"
    },
    "creatives": [
      { 
        "type": "image", 
        "url": "https://example.com/ad.jpg",
        "dimensions": { "width": 1200, "height": 600 }
      }
    ],
    "products": ["PRODUCT_ID_1", "PRODUCT_ID_2"],
    "targeting": {
      "regions": ["us", "eu"],
      "demographics": { "age": "18-45", "gender": "all" }
    },
    "status": "draft",
    "createdAt": "2025-08-18T10:31:00.000Z"
  },
  "requestId": "REQUEST_ID",
  "timestamp": "2025-08-18T10:31:00.000Z"
}`}
                    language="json"
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.listAdCampaigns')}</h3>
                  <p className="mb-2">{t('oauth.listAdCampaignsDesc')}</p>
                  <CodeBlock
                    code={`GET ${process.env.NEXT_PUBLIC_BASE_URL}/api/seller/ads
Authorization: Bearer YOUR_API_KEY
Accept: application/json`}
                  />
                  <p className="mt-2">{t('oauth.listAdCampaignsResponse')}</p>
                  <CodeBlock
                    code={`{
  "success": true,
  "data": [
    {
      "_id": "CAMPAIGN_ID_1",
      "name": "Summer Sale Campaign",
      "status": "active",
      "budget": { "amount": 1000, "currency": "USD" },
      "createdAt": "2025-08-18T10:31:00.000Z"
    },
    {
      "_id": "CAMPAIGN_ID_2",
      "name": "Winter Promo",
      "status": "paused",
      "budget": { "amount": 500, "currency": "USD" },
      "createdAt": "2025-08-18T10:31:00.000Z"
    }
  ],
  "requestId": "REQUEST_ID",
  "timestamp": "2025-08-18T10:31:00.000Z"
}`}
                    language="json"
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.updateAdCampaign')}</h3>
                  <p className="mb-2">{t('oauth.updateAdCampaignDesc')}</p>
                  <CodeBlock
                    code={`PATCH ${process.env.NEXT_PUBLIC_BASE_URL}/api/seller/ads/CAMPAIGN_ID
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "name": "Updated Summer Sale Campaign",
  "budget": { "amount": 1500, "currency": "USD" },
  "status": "active",
  "targeting": {
    "regions": ["us", "eu", "asia"],
    "demographics": { "age": "25-50", "gender": "all" }
  }
}`}
                  />
                  <p className="mt-2">{t('oauth.updateAdCampaignResponse')}</p>
                  <CodeBlock
                    code={`{
  "success": true,
  "data": {
    "_id": "CAMPAIGN_ID",
    "name": "Updated Summer Sale Campaign",
    "budget": { "amount": 1500, "currency": "USD" },
    "status": "active",
    "targeting": {
      "regions": ["us", "eu", "asia"],
      "demographics": { "age": "25-50", "gender": "all" }
    },
    "updatedAt": "2025-08-18T10:31:00.000Z"
  },
  "requestId": "REQUEST_ID",
  "timestamp": "2025-08-18T10:31:00.000Z"
}`}
                    language="json"
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.deleteAdCampaign')}</h3>
                  <p className="mb-2">{t('oauth.deleteAdCampaignDesc')}</p>
                  <CodeBlock
                    code={`DELETE ${process.env.NEXT_PUBLIC_BASE_URL}/api/seller/ads/CAMPAIGN_ID
Authorization: Bearer YOUR_API_KEY`}
                  />
                  <p className="mt-2">{t('oauth.deleteAdCampaignResponse')}</p>
                  <CodeBlock
                    code={`{
  "success": true,
  "data": {
    "_id": "CAMPAIGN_ID",
    "status": "deleted",
    "deletedAt": "2025-08-18T10:31:00.000Z"
  },
  "requestId": "REQUEST_ID",
  "timestamp": "2025-08-18T10:31:00.000Z"
}`}
                    language="json"
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.syncAdMetrics')}</h3>
                  <p className="mb-2">{t('oauth.syncAdMetricsDesc')}</p>
                  <CodeBlock
                    code={`POST ${process.env.NEXT_PUBLIC_BASE_URL}/api/seller/ads/sync
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "campaignId": "CAMPAIGN_ID",
  "sandbox": false
}`}
                  />
                  <p className="mt-2">{t('oauth.syncAdMetricsResponse')}</p>
                  <CodeBlock
                    code={`{
  "success": true,
  "data": {
    "metrics": {
      "impressions": 1000,
      "clicks": 50,
      "conversions": 5,
      "cost": { "amount": 50.25, "currency": "USD" }
    },
    "updatedAt": "2025-08-18T10:31:00.000Z"
  },
  "requestId": "REQUEST_ID",
  "timestamp": "2025-08-18T10:31:00.000Z"
}`}
                    language="json"
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.advertisementsJs')}</h3>
                  <p className="mb-2">{t('oauth.advertisementsJsDesc')}</p>
                  <CodeBlock
                    code={`const fetch = require('node-fetch');

async function createAdCampaign(apiKey, campaignData) {
  const response = await fetch('${process.env.NEXT_PUBLIC_BASE_URL}/api/seller/ads?sandbox=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${apiKey}\`
    },
    body: JSON.stringify(campaignData)
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to create campaign');
  }
  return result.data;
}

const campaignData = {
  integrationId: 'INTEGRATION_ID',
  name: 'Summer Sale Campaign',
  budget: { amount: 1000, currency: 'USD' },
  schedule: { 
    startDate: '2025-08-18T10:00:00.000Z',
    endDate: '2025-09-18T10:00:00.000Z'
  },
  creatives: [
    { 
      type: 'image', 
      url: 'https://example.com/ad.jpg',
      dimensions: { width: 1200, height: 600 }
    }
  ],
  products: ['PRODUCT_ID_1', 'PRODUCT_ID_2'],
  targeting: {
    regions: ['us', 'eu'],
    demographics: { age: '18-45', gender: 'all' }
  }
};

createAdCampaign('YOUR_API_KEY', campaignData)
  .then(data => console.log('Ad campaign created:', data))
  .catch(err => console.error('Ad creation failed:', err.message));`}
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.advertisementsPython')}</h3>
                  <p className="mb-2">{t('oauth.advertisementsPythonDesc')}</p>
                  <CodeBlock
                    code={`import requests

def create_ad_campaign(api_key, campaign_data):
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}'
    }
    response = requests.post('${process.env.NEXT_PUBLIC_BASE_URL}/api/seller/ads?sandbox=false', 
                           headers=headers, 
                           json=campaign_data)
    result = response.json()
    if not result.get('success'):
        raise Exception(result.get('error', 'Failed to create campaign'))
    return result['data']

campaign_data = {
    'integrationId': 'INTEGRATION_ID',
    'name': 'Summer Sale Campaign',
    'budget': {'amount': 1000, 'currency': 'USD'},
    'schedule': {
        'startDate': '2025-08-18T10:00:00.000Z',
        'endDate': '2025-09-18T10:00:00.000Z'
    },
    'creatives': [
        {
            'type': 'image',
            'url': 'https://example.com/ad.jpg',
            'dimensions': {'width': 1200, 'height': 600}
        }
    ],
    'products': ['PRODUCT_ID_1', 'PRODUCT_ID_2'],
    'targeting': {
        'regions': ['us', 'eu'],
        'demographics': {'age': '18-45', 'gender': 'all'}
    }
}

try:
    data = create_ad_campaign('YOUR_API_KEY', campaign_data)
    print('Ad campaign created:', data)
except Exception as e:
    print('Ad creation failed:', str(e))
`}
                    language="python"
                  />
                </CardContent>
              </Card>
            </section>
          )}

          {activeSection === 'example' && (
            <section id="example" className="scroll-mt-28">
              <Card className="mb-8 glass">
                <CardHeader>
                  <CardTitle>{t('oauth.example')}</CardTitle>
                </CardHeader>
                <CardContent className="card-content">
                  <h3 className="text-lg font-semibold mb-2">{t('oauth.exampleNode')}</h3>
                  <p>{t('oauth.exampleNodeDesc')}</p>
                  <CodeBlock
                    code={`const express = require('express');
const passport = require('passport');
const MGZonStrategy = require('passport-mgzon');

passport.use(new MGZonStrategy({
  clientID: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  callbackURL: 'https://your-app.com/auth/mgz/callback',
  scope: ['profile:read', 'products:write', 'inventory:write']
}, async (accessToken, refreshToken, profile, done) => {
  const user = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    sellerId: profile.sellerId
  };
  return done(null, user);
}));

app.get('/auth/mgz', passport.authenticate('mgzon'));

app.get('/auth/mgz/callback', passport.authenticate('mgzon', { session: false }), (req, res) => {
  res.redirect('/profile');
});

app.listen(3000, () => console.log('Server running on port 3000'));`}
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.examplePython')}</h3>
                  <p>{t('oauth.examplePythonDesc')}</p>
                  <CodeBlock
                    code={`from flask import Flask, redirect, url_for, request
import requests

app = Flask(__name__)

MGZON_AUTH_URL = '${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/mgz'
MGZON_TOKEN_URL = '${process.env.NEXT_PUBLIC_BASE_URL}/api/token'
MGZON_USERINFO_URL = '${process.env.NEXT_PUBLIC_BASE_URL}/api/userinfo'
CLIENT_ID = 'YOUR_CLIENT_ID'
CLIENT_SECRET = 'YOUR_CLIENT_SECRET'
REDIRECT_URI = 'https://your-app.com/auth/mgz/callback'

@app.route('/auth/mgz')
def auth_mgz():
    auth_url = f'{MGZON_AUTH_URL}?client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&scope=profile:read%20products:write%20inventory:write&state=STATE'
    return redirect(auth_url)

@app.route('/auth/mgz/callback')
def callback():
    code = request.args.get('code')
    if not code:
        return 'Error: No code provided', 400
    token_response = requests.post(MGZON_TOKEN_URL, json={
        'grant_type': 'authorization_code',
        'code': code,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'redirect_uri': REDIRECT_URI
    })
    token_data = token_response.json()
    if 'error' in token_data:
        return f'Error: {token_data["error"]}', 400
    access_token = token_data['access_token']
    user_response = requests.get(MGZON_USERINFO_URL, headers={'Authorization': f'Bearer {access_token}'})
    user_data = user_response.json()
    return f'Welcome {user_data["name"]}! Seller ID: {user_data["sellerId"]}'

if __name__ == '__main__':
    app.run(port=3000)`}
                    language="python"
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.exampleSellerImport')}</h3>
                  <p>{t('oauth.exampleSellerImportDesc')}</p>
                  <CodeBlock
                    code={`const fetch = require('node-fetch');

async function importProduct(apiKey, sellerId, provider, productId) {
  const response = await fetch('${process.env.NEXT_PUBLIC_BASE_URL}/api/products/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${apiKey}\`
    },
    body: JSON.stringify({
      provider,
      productId,
      sellerId,
      region: 'us'
    })
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error);
  }
  console.log('Imported product:', result.data);
}

importProduct('YOUR_API_KEY', 'YOUR_SELLER_ID', 'shopify', 'SHOPIFY_PRODUCT_ID')
  .catch(err => console.error('Import failed:', err.message));`}
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.exampleSellerExport')}</h3>
                  <p>{t('oauth.exampleSellerExportDesc')}</p>
                  <CodeBlock
                    code={`const fetch = require('node-fetch');

async function exportProduct(apiKey, sellerId, productId, targetPlatform) {
  const response = await fetch('${process.env.NEXT_PUBLIC_BASE_URL}/api/products/export', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${apiKey}\`
    },
    body: JSON.stringify({
      productId,
      targetPlatform,
      sellerId,
      region: 'us'
    })
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error);
  }
  console.log('Exported product:', result.data);
}

exportProduct('YOUR_API_KEY', 'YOUR_SELLER_ID', 'PRODUCT_ID', 'shipbob')
  .catch(err => console.error('Export failed:', err.message));`}
                  />
                </CardContent>
              </Card>
            </section>
          )}

          {activeSection === 'developers' && (
            <section id="developers" className="scroll-mt-28">
              <Card className="mb-8 glass">
                <CardHeader>
                  <CardTitle>{t('oauth.developers')}</CardTitle>
                </CardHeader>
                <CardContent className="card-content">
                  <p className="mb-4">{t('oauth.developersDesc')}</p>
                  <h3 className="text-lg font-semibold mb-2">{t('oauth.developersCreateApp')}</h3>
                  <p>{t('oauth.developersCreateAppDesc')}</p>
                  <CodeBlock
                    code={`// Example: Creating an OAuth application
const fetch = require('node-fetch');

async function createApplication(token, name, redirectUris, scopes) {
  const response = await fetch('${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/clients', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${token}\`
    },
    body: JSON.stringify({ name, redirectUris, scopes })
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
}

createApplication('YOUR_ACCESS_TOKEN', 'MyApp', ['https://your-app.com/callback'], ['profile:read', 'products:write'])
  .then(data => console.log('Client ID:', data.clientId))
  .catch(err => console.error('Error:', err.message));`}
                  />
                  <h3 className="text-lg font-semibold mb-2 mt-4">{t('oauth.developersListApps')}</h3>
                  <p>{t('oauth.developersListAppsDesc')}</p>
                  <CodeBlock
                    code={`// Example: Listing OAuth applications
const fetch = require('node-fetch');

async function listApplications(token) {
  const response = await fetch('${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/clients', {
    headers: { Authorization: \`Bearer \${token}\` }
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data.clients;
}

listApplications('YOUR_ACCESS_TOKEN')
  .then(clients => console.log('Applications:', clients))
  .catch(err => console.error('Error:', err.message));`}
                  />
                </CardContent>
              </Card>
            </section>
          )}
        </main>

        {/* Chatbot */}
        <Chatbote />

        {/* Footer */}
      </div>
      <FooterDoce />
    </div>
  );
}