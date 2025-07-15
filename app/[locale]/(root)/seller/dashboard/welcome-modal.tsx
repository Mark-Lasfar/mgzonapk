'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Confetti from 'react-confetti';
// import { ISeller } from '@/lib/types';
import { motion } from 'framer-motion';
import { ISeller } from '@/lib/db/models/seller.model';

interface WelcomeModalProps {
  seller: ISeller;
}

export default function WelcomeModal({ seller }: WelcomeModalProps) {
  const t = useTranslations('Seller.Welcome');
  const [isOpen, setIsOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    // Show modal if seller is new (created within the last 24 hours)
    const createdAt = new Date(seller.createdAt);
    const now = new Date();
    const isNewSeller = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60) < 24;

    if (isNewSeller) {
      setIsOpen(true);
      // Stop confetti after 5 seconds
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [seller]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px]">
        {showConfetti && <Confetti width={600} height={400} />}
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-lg font-semibold">{t('congratulations', { businessName: seller.businessName })}</p>
          <p className="mt-2">{t('welcomeMessage')}</p>
          <p className="mt-2">{t('pointsEarned', { points: seller.pointsBalance })}</p>
          <p className="mt-2">{t('pointsUsage')}</p>
          <p className="mt-2">{t('withdrawalInstructions')}</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => setIsOpen(false)}>{t('getStarted')}</Button>
        </div>
        {/* Animated Balloons */}
        <motion.div
          className="absolute bottom-0 left-0"
          animate={{ y: [-50, -100, -50] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          🎈
        </motion.div>
        <motion.div
          className="absolute bottom-0 right-0"
          animate={{ y: [-50, -100, -50] }}
          transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
        >
          🎈
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}