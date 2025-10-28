'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Confetti from 'react-confetti';
import { motion } from 'framer-motion';
import { ISeller } from '@/lib/db/models/seller.model';
import { Gift, Star } from 'lucide-react';

interface WelcomeModalProps {
  seller: ISeller;
}

export default function WelcomeModal({ seller }: WelcomeModalProps) {
  const t = useTranslations('Seller.Welcome');
  const [isOpen, setIsOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const createdAt = new Date(seller.createdAt);
    const now = new Date();
    const isNewSeller = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60) < 24;

    if (isNewSeller) {
      setIsOpen(true);
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [seller]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px] bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
        {showConfetti && <Confetti width={600} height={400} />}
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center">
            <Star className="h-6 w-6 mr-2 text-yellow-500" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('welcomeMessage')}</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-lg font-semibold flex items-center">
            <Gift className="h-5 w-5 mr-2 text-primary" />
            {t('congratulations', { businessName: seller.businessName })}
          </p>
          <p>{t('pointsEarned', { points: seller.pointsBalance })}</p>
          <p>{t('pointsUsage')}</p>
          <p>{t('withdrawalInstructions')}</p>
          <p className="text-sm text-muted-foreground">
            {t('nextSteps')}: {t('nextStepsDescription')}
          </p>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => setIsOpen(false)}
            className="bg-primary hover:bg-primary-dark transition-colors"
          >
            {t('getStarted')}
          </Button>
        </div>
        <motion.div
          className="absolute bottom-0 left-0 text-3xl"
          animate={{ y: [-50, -100, -50] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          🎈
        </motion.div>
        <motion.div
          className="absolute bottom-0 right-0 text-3xl"
          animate={{ y: [-50, -100, -50] }}
          transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
        >
          🎈
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}