'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Github, Twitter, Mail, Phone, HelpCircle, Code2, BookOpen, Video, Library, Newspaper, Info, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Interface for card data
interface FooterCard {
  title: string;
  description: string;
  details: string;
  icon: React.ReactNode;
}

// Interface for section data
interface FooterSection {
  title: string;
  cards: FooterCard[];
}

export function FooterDoce() {
  const t = useTranslations('FooterDocs');
  const [selectedCard, setSelectedCard] = useState<FooterCard | null>(null);

  const sections: FooterSection[] = [
    {
      title: t('contact.title'),
      cards: [
        {
          title: t('contact.email.title'),
          description: t('contact.email.description'),
          details: t('contact.email.details'),
          icon: <Mail className="w-12 h-12 text-blue-400" />,
        },
        {
          title: t('contact.phone.title'),
          description: t('contact.phone.description'),
          details: t('contact.phone.details'),
          icon: <Phone className="w-12 h-12 text-blue-400" />,
        },
        {
          title: t('contact.hours.title'),
          description: t('contact.hours.description'),
          details: t('contact.hours.details'),
          icon: <Users className="w-12 h-12 text-blue-400" />,
        },
      ],
    },
    {
      title: t('resources.title'),
      cards: [
        {
          title: t('resources.apiDocs.title'),
          description: t('resources.apiDocs.description'),
          details: t('resources.apiDocs.details'),
          icon: <Code2 className="w-12 h-12 text-green-400" />,
        },
        {
          title: t('resources.faq.title'),
          description: t('resources.faq.description'),
          details: t('resources.faq.details'),
          icon: <HelpCircle className="w-12 h-12 text-green-400" />,
        },
        {
          title: t('resources.docs.title'),
          description: t('resources.docs.description'),
          details: t('resources.docs.details'),
          icon: (
            <Image
              src="https://github.blog/wp-content/uploads/2024/07/Icon-Circle.svg"
              alt="Docs Icon"
              width={48}
              height={48}
              className="text-green-400"
            />
          ),
        },
      ],
    },
    {
      title: t('support.title'),
      cards: [
        {
          title: t('support.contactUs.title'),
          description: t('support.contactUs.description'),
          details: t('support.contactUs.details'),
          icon: <Mail className="w-12 h-12 text-yellow-400" />,
        },
        {
          title: t('support.community.title'),
          description: t('support.community.description'),
          details: t('support.community.details'),
          icon: <Users className="w-12 h-12 text-yellow-400" />,
        },
        {
          title: t('support.tickets.title'),
          description: t('support.tickets.description'),
          details: t('support.tickets.details'),
          icon: <HelpCircle className="w-12 h-12 text-yellow-400" />,
        },
      ],
    },
    {
      title: t('about.title'),
      cards: [
        {
          title: t('about.mgzon.title'),
          description: t('about.mgzon.description'),
          details: t('about.mgzon.details'),
          icon: <Info className="w-12 h-12 text-purple-400" />,
        },
        {
          title: t('about.team.title'),
          description: t('about.team.description'),
          details: t('about.team.details'),
          icon: <Users className="w-12 h-12 text-purple-400" />,
        },
        {
          title: t('about.mission.title'),
          description: t('about.mission.description'),
          details: t('about.mission.details'),
          icon: (
            <Image
              src="https://raw.githubusercontent.com/Mark-Lasfar/MGZon/9a1b2149507ae61fec3bb7fb86d8d16c11852f3b/public/icons/mg.svg"
              alt="MGZon Logo"
              width={48}
              height={48}
              className="text-purple-400"
            />
          ),
        },
      ],
    },
    {
      title: t('media.title'),
      cards: [
        {
          title: t('media.videos.title'),
          description: t('media.videos.description'),
          details: t('media.videos.details'),
          icon: <Video className="w-12 h-12 text-red-400" />,
        },
        {
          title: t('media.books.title'),
          description: t('media.books.description'),
          details: t('media.books.details'),
          icon: <Library className="w-12 h-12 text-red-400" />,
        },
        {
          title: t('media.articles.title'),
          description: t('media.articles.description'),
          details: t('media.articles.details'),
          icon: <Newspaper className="w-12 h-12 text-red-400" />,
        },
      ],
    },
  ];

  return (
    <footer className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white py-20 mt-12 animate-gradient-x">
      <div className="container mx-auto px-6">
        {/* Logo and Company Description */}
        <div className="mb-16 text-center">
          <Image
            src="https://raw.githubusercontent.com/Mark-Lasfar/MGZon/9a1b2149507ae61fec3bb7fb86d8d16c11852f3b/public/icons/mg.svg"
            alt="MGZon Logo"
            width={120}
            height={120}
            className="mx-auto mb-6 object-contain animate-pulse"
          />
          <p className="text-gray-300 max-w-2xl mx-auto text-lg">{t('company.description')}</p>
        </div>

        {/* Sections with Cards */}
        {sections.map((section) => (
          <div key={section.title} className="mb-16">
            <h3 className="text-4xl font-bold mb-10 text-center text-white drop-shadow-lg">
              {section.title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {section.cards.map((card) => (
                <Card
                  key={card.title}
                  className={cn(
                    'bg-gray-800/90 hover:bg-gray-700/95 transition-all duration-300 transform hover:scale-110 hover:shadow-2xl border border-gray-700 cursor-pointer min-h-[320px] p-6 group relative overflow-hidden',
                    'animate-fade-in'
                  )}
                  onClick={() => setSelectedCard(card)}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <CardHeader className="text-center">
                    <div className="flex justify-center mb-6">{card.icon}</div>
                    <CardTitle className="text-2xl text-white group-hover:text-blue-300 transition-colors">
                      {card.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-300 text-center text-lg">{card.description}</p>
                    <p className="text-gray-400 text-center text-sm mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {card.details.substring(0, 100)}...
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {/* Modal for Card Details */}
        <Dialog open={!!selectedCard} onOpenChange={() => setSelectedCard(null)}>
          <DialogContent className="sm:max-w-[700px] bg-gray-800 text-white border border-gray-700 rounded-xl transition-all duration-300">
            <DialogHeader>
              <DialogTitle className="text-3xl flex items-center gap-3">
                {selectedCard?.icon}
                {selectedCard?.title}
              </DialogTitle>
              <DialogDescription className="text-gray-300 text-lg mt-4">
                {selectedCard?.details}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-500 text-lg py-6"
                onClick={() => setSelectedCard(null)}
              >
                {t('close.title')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Social Links and Copyright */}
        <div className="mt-16 text-center">
          <div className="flex justify-center space-x-10 mb-8">
            <a href="https://github.com/Mark-Lasfar/MGZon" className="hover:text-blue-300 transition-colors">
              <Github className="w-10 h-10" />
            </a>
            <a href="https://twitter.com/MGZon" className="hover:text-blue-300 transition-colors">
              <Twitter className="w-10 h-10" />
            </a>
          </div>
          <p className="text-lg text-gray-400">
            &copy; {new Date().getFullYear()} MGZon. {t('rights.description')}
          </p>
        </div>
      </div>

      {/* CSS for Animations and Enhanced Styling */}
      <style jsx>{`
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient 15s ease infinite;
        }

        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.5s ease-in;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .group:hover .text-blue-300 {
          color: #60a5fa;
        }
      `}</style>
    </footer>
  );
}