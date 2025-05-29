'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { awardPoints, getPointsBalance } from '@/lib/actions/points.actions';
import { Trophy, Star, Search, Home, LogIn } from 'lucide-react';
import { Howl } from 'howler';

interface LeaderboardEntry {
  username: string;
  score: number;
  date: string;
}

export default function NotFound() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [playerWeapon, setPlayerWeapon] = useState<string | null>(null);
  const [level, setLevel] = useState(1);
  const [isNightMode, setIsNightMode] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [userScore, setUserScore] = useState<LeaderboardEntry | null>(null);
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { data: session, status } = useSession();
  const t = useTranslations('notFound');
  const locale = useLocale();

  const isAuthenticated = status === 'authenticated';
  const userId = session?.user?.id;
  const username = session?.user?.name || 'Guest';

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch('/api/leaderboard');
        if (response.ok) {
          const data = await response.json();
          setLeaderboard(data);
        } else {
          console.error('Failed to fetch leaderboard:', response.status);
        }
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      }
    };
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (isAuthenticated && userId) {
      const fetchPoints = async () => {
        try {
          const balance = await getPointsBalance(userId);
          setPointsBalance(balance);
        } catch (error) {
          console.error('Error fetching points balance:', error);
          setNotification({ message: t('errorSearching'), type: 'error' });
        }
      };
      fetchPoints();
    }
  }, [isAuthenticated, userId, t]);

  const saveScore = async (finalScore: number) => {
    if (!isAuthenticated) {
      setNotification({ message: t('pleaseLogin'), type: 'error' });
      return;
    }

    try {
      const scoreResponse = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          score: finalScore,
          username,
        }),
      });

      if (!scoreResponse.ok) {
        throw new Error('Failed to save score');
      }

      const points = Math.floor(finalScore / 100);
      if (points > 0) {
        const result = await awardPoints(userId!, points, `Dino Game Score: ${finalScore}`);
        if (result.success) {
          setNotification({ message: `${points} ${t('points')} ${t('awarded')}`, type: 'success' });
          const balance = await getPointsBalance(userId!);
          setPointsBalance(balance);
        } else {
          setNotification({ message: result.message, type: 'error' });
        }
      }

      const leaderboardResponse = await fetch('/api/leaderboard');
      if (leaderboardResponse.ok) {
        const data = await leaderboardResponse.json();
        setLeaderboard(data);
      }
    } catch (error) {
      console.error('Error saving score or awarding points:', error);
      setNotification({ message: t('errorSaving'), type: 'error' });
    }
  };

  const searchUserScore = async () => {
    if (!searchUsername) {
      setNotification({ message: t('enterUsername'), type: 'error' });
      return;
    }
    try {
      const response = await fetch(`/api/leaderboard/user/${searchUsername}`);
      if (response.ok) {
        const data = await response.json();
        setUserScore(data);
        setNotification({ message: t('scoreFound'), type: 'success' });
      } else {
        setUserScore(null);
        setNotification({ message: t('userNotFound'), type: 'error' });
      }
    } catch (error) {
      console.error('Error fetching user score:', error);
      setUserScore(null);
      setNotification({ message: t('errorSearching'), type: 'error' });
    }
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas context');
      return;
    }

    canvas.width = 800;
    canvas.height = 400;

    const jumpSound = new Howl({ src: ['/sounds/jump.wav'], volume: 0.5 });
    const collisionSound = new Howl({ src: ['/sounds/collision.wav'], volume: 0.5 });
    const gameOverSound = new Howl({ src: ['/sounds/gameover.wav'], volume: 0.6 });
    const weaponSound = new Howl({ src: ['/sounds/collision.wav'], volume: 0.4 });
    const backgroundMusic = new Howl({
      src: ['/sounds/background-music.wav'],
      loop: true,
      volume: 0.3,
      autoplay: true,
    });

    const images: { [key: string]: HTMLImageElement | null } = {};
    const imageSources = [
      'dino.png', 'dino-duck.png', 'cactus.png', 'pterodactyl.png', 'tree.png',
      'car.png', 'sword.png', 'gun.png', 'hammer.png', 'cloud.png'
    ];

    let loadImagesPromise = Promise.all(
      imageSources.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.src = `/images/${src}`;
            img.onload = () => {
              images[src.split('.')[0]] = img;
              resolve(null);
            };
            img.onerror = () => {
              console.warn(`Failed to load image: /images/${src}`);
              images[src.split('.')[0]] = null;
              resolve(null);
            };
          })
      )
    );

    loadImagesPromise.then(() => {
      let dino = {
        x: 50,
        y: 300,
        width: 60,
        height: 60,
        dy: 0,
        gravity: 0.8,
        jumpPower: -15,
        isJumping: false,
        isDucking: false,
      };

      let obstacles: { x: number; y: number; width: number; height: number; type: string }[] = [];
      let weapons: { x: number; y: number; width: number; height: number; type: string }[] = [];
      let clouds: { x: number; y: number; width: number; height: number }[] = [];
      let particles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
      let frameCount = 0;
      let obstacleSpeed = 6;
      let obstacleFrequency = 80;
      let isGameRunning = false;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !isGameRunning) {
          isGameRunning = true;
          setIsGameOver(false);
          setScore(0);
          setLevel(1);
          setIsNightMode(false);
          setPlayerWeapon(null);
          obstacles = [];
          weapons = [];
          particles = [];
          clouds = [];
          dino.y = 300;
          dino.dy = 0;
          dino.isJumping = false;
          dino.isDucking = false;
          dino.height = 60;
          obstacleSpeed = 6;
          obstacleFrequency = 80;
          backgroundMusic.play();
        }
        if (e.code === 'Space' && !dino.isJumping && isGameRunning) {
          dino.dy = dino.jumpPower;
          dino.isJumping = true;
          dino.isDucking = false;
          jumpSound.play();
        }
        if (e.code === 'ArrowDown' && !dino.isJumping && isGameRunning) {
          dino.isDucking = true;
          dino.height = 40;
          dino.y = 320;
        }
        if (e.code === 'KeyF' && playerWeapon && isGameRunning) {
          if (obstacles.length > 0) {
            const obstacle = obstacles[0];
            for (let i = 0; i < 10; i++) {
              particles.push({
                x: obstacle.x + obstacle.width / 2,
                y: obstacle.y + obstacle.height / 2,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                life: 30,
              });
            }
            obstacles.shift();
            weaponSound.play();
            setPlayerWeapon(null);
          }
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'ArrowDown' && isGameRunning) {
          dino.isDucking = false;
          dino.height = 60;
          dino.y = 300;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      const drawDino = () => {
        const img = dino.isDucking && images['dino-duck'] ? images['dino-duck'] : images['dino'];
        if (img) {
          ctx.drawImage(img, dino.x, dino.y, dino.width, dino.height);
        } else {
          ctx.fillStyle = 'red';
          ctx.beginPath();
          ctx.rect(dino.x, dino.y, dino.width, dino.height);
          ctx.fill();
          ctx.fillStyle = 'black';
          ctx.fillRect(dino.x + (dino.isDucking ? 20 : 40), dino.y + 10, 10, 10);
        }
      };

      const drawObstacles = () => {
        obstacles.forEach((obstacle) => {
          const img = images[obstacle.type];
          if (img) {
            ctx.drawImage(img, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
          } else {
            ctx.fillStyle =
              obstacle.type === 'cactus' ? 'green' :
              obstacle.type === 'pterodactyl' ? 'gray' :
              obstacle.type === 'tree' ? 'brown' : 'blue';
            ctx.beginPath();
            if (obstacle.type === 'cactus') {
              ctx.rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
              ctx.fill();
              ctx.fillRect(obstacle.x + obstacle.width / 2, obstacle.y - 10, 5, 10);
            } else if (obstacle.type === 'pterodactyl') {
              ctx.moveTo(obstacle.x, obstacle.y + obstacle.height / 2);
              ctx.lineTo(obstacle.x + obstacle.width, obstacle.y);
              ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height);
              ctx.closePath();
              ctx.fill();
            } else {
              ctx.rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
              ctx.fill();
            }
          }
        });
      };

      const drawWeapons = () => {
        weapons.forEach((weapon) => {
          const img = images[weapon.type];
          if (img) {
            ctx.drawImage(img, weapon.x, weapon.y, weapon.width, weapon.height);
          } else {
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            if (weapon.type === 'sword') {
              ctx.rect(weapon.x, weapon.y, weapon.width, weapon.height);
              ctx.fill();
              ctx.fillStyle = 'gray';
              ctx.fillRect(weapon.x, weapon.y + weapon.height, weapon.width / 2, 5);
            } else if (weapon.type === 'gun') {
              ctx.rect(weapon.x, weapon.y, weapon.width, weapon.height / 2);
              ctx.fill();
              ctx.fillRect(weapon.x + weapon.width, weapon.y, 5, weapon.height / 2);
            } else if (weapon.type === 'hammer') {
              ctx.rect(weapon.x, weapon.y, weapon.width / 2, weapon.height);
              ctx.fill();
              ctx.fillRect(weapon.x + weapon.width / 2, weapon.y - 5, weapon.width / 2, weapon.height / 2);
            }
          }
        });
      };

      const drawClouds = () => {
        clouds.forEach((cloud) => {
          if (images['cloud']) {
            ctx.drawImage(images['cloud'], cloud.x, cloud.y, cloud.width, cloud.height);
          } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.beginPath();
            ctx.ellipse(cloud.x + cloud.width / 2, cloud.y + cloud.height / 2, cloud.width / 2, cloud.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      };

      const drawParticles = () => {
        particles.forEach((particle, index) => {
          ctx.fillStyle = 'orange';
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
          ctx.fill();
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.life--;
          if (particle.life <= 0) {
            particles.splice(index, 1);
          }
        });
      };

      const update = () => {
        if (!isGameRunning) return;

        dino.dy += dino.gravity;
        dino.y += dino.dy;
        if (dino.y > 300 && !dino.isDucking) {
          dino.y = 300;
          dino.dy = 0;
          dino.isJumping = false;
        }

        if (frameCount % obstacleFrequency === 0) {
          const types = ['cactus', 'pterodactyl', 'tree', 'car'];
          const type = types[Math.floor(Math.random() * types.length)];
          obstacles.push({
            x: canvas.width,
            y: type === 'pterodactyl' ? 250 : 300,
            width: type === 'car' ? 60 : 30,
            height: type === 'pterodactyl' ? 30 : 60,
            type,
          });
        }

        if (frameCount % 150 === 0) {
          const weaponTypes = ['sword', 'gun', 'hammer'];
          weapons.push({
            x: canvas.width,
            y: 280,
            width: 20,
            height: 20,
            type: weaponTypes[Math.floor(Math.random() * weaponTypes.length)],
          });
        }

        if (frameCount % 200 === 0) {
          clouds.push({
            x: canvas.width,
            y: 50 + Math.random() * 50,
            width: 50,
            height: 30,
          });
        }

        obstacles.forEach((obstacle) => (obstacle.x -= obstacleSpeed));
        weapons.forEach((weapon) => (weapon.x -= obstacleSpeed));
        clouds.forEach((cloud) => (cloud.x -= obstacleSpeed * 0.5));
        obstacles = obstacles.filter((obstacle) => obstacle.x > -obstacle.width);
        weapons = weapons.filter((weapon) => weapon.x > -weapon.width);
        clouds = clouds.filter((cloud) => cloud.x > -cloud.width);

        obstacles.forEach((obstacle) => {
          if (
            dino.x < obstacle.x + obstacle.width &&
            dino.x + dino.width > obstacle.x &&
            dino.y < obstacle.y + obstacle.height &&
            dino.y + dino.height > obstacle.y
          ) {
            isGameRunning = false;
            setIsGameOver(true);
            collisionSound.play();
            gameOverSound.play();
            backgroundMusic.stop();
            saveScore(Math.floor(score));
          }
        });

        weapons.forEach((weapon, index) => {
          if (
            dino.x < weapon.x + weapon.width &&
            dino.x + dino.width > weapon.x &&
            dino.y < weapon.y + weapon.height &&
            dino.y + dino.height > weapon.y
          ) {
            setPlayerWeapon(weapon.type);
            weapons.splice(index, 1);
            weaponSound.play();
          }
        });

        if (score > level * 1000) {
          setLevel((prev) => prev + 1);
          obstacleSpeed += 0.5;
          obstacleFrequency = Math.max(50, obstacleFrequency - 5);
        }

        if (score > 700 && !isNightMode) {
          setIsNightMode(true);
        }

        frameCount++;
        setScore((prev) => prev + 0.2);
      };

      const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (isNightMode) {
          ctx.fillStyle = '#1a1a1a';
        } else {
          ctx.fillStyle = '#f0f0f0';
        }
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#d2b48c';
        ctx.fillRect(0, 340, canvas.width, 60);

        drawClouds();
        drawDino();
        drawObstacles();
        drawWeapons();
        drawParticles();

        ctx.fillStyle = isNightMode ? 'white' : 'black';
        ctx.font = '20px Arial';
        ctx.fillText(`${t('score')}: ${Math.floor(score)}`, 20, 30);
        ctx.fillText(`${t('level')}: ${level}`, 20, 60);
        if (playerWeapon) {
          ctx.fillText(`${t('weapon')}: ${playerWeapon === 'sword' ? t('sword') : playerWeapon === 'gun' ? t('gun') : t('hammer')}`, 20, 90);
        }

        if (!isGameRunning && !isGameOver) {
          ctx.fillStyle = 'black';
          ctx.font = '40px Arial';
          ctx.fillText(t('startGame'), canvas.width / 2 - 180, canvas.height / 2);
        } else if (isGameOver) {
          ctx.fillStyle = 'red';
          ctx.font = '40px Arial';
          ctx.fillText(t('gameOver'), canvas.width / 2 - 100, canvas.height / 2);
          ctx.font = '20px Arial';
          ctx.fillText(t('restart'), canvas.width / 2 - 120, canvas.height / 2 + 40);
        }
      };

      const gameLoop = () => {
        update();
        draw();
        requestAnimationFrame(gameLoop);
      };

      gameLoop();

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        backgroundMusic.stop();
      };
    }).catch((error) => {
      console.error('Error loading images:', error);
    });
  }, [isAuthenticated, score, isGameOver, playerWeapon, level, isNightMode, t]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 py-8">
      {notification && (
        <div className={`fixed top-4 px-4 py-2 rounded-md shadow-md text-white ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {notification.message}
        </div>
      )}
      <div className="p-6 rounded-lg shadow-md w-full max-w-md text-center bg-white mb-6">
        <h1 className="text-3xl font-bold mb-4 text-gray-800 flex items-center justify-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500" />
          {t('title')}
        </h1>
        <p className="text-red-600 mb-4">{t('message')}</p>
      </div>
      {!isAuthenticated && (
        <div className="mb-6 text-center">
          <p className="text-gray-700 mb-2">{t('pleaseLogin')}</p>
          <Link href={`/${locale}/sign-in`}>
            <Button variant="default" className="px-6 py-2 bg-blue-600 text-white flex items-center gap-2">
              <LogIn className="w-4 h-4" />
              {t('login')}
            </Button>
          </Link>
        </div>
      )}
      {isAuthenticated && pointsBalance !== null && (
        <div className="mb-6 text-center bg-white p-4 rounded-lg shadow-md w-full max-w-md">
          <p className="text-gray-700 flex items-center justify-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            {t('yourPoints')}: {pointsBalance} {t('points')}
          </p>
        </div>
      )}
      <canvas ref={canvasRef} className="border-2 border-black bg-white mb-6 rounded-lg shadow-md" />
      <div className="p-6 rounded-lg shadow-md w-full max-w-md text-center bg-white">
        <p className="mb-4 text-gray-700">{t('instructions')}</p>
        <div className="mb-4 text-sm text-gray-600 space-y-2">
          <p>{t('score')}: {Math.floor(score)}</p>
          <p>{t('level')}: {level}</p>
          {playerWeapon && (
            <p>
              {t('weapon')}: {playerWeapon === 'sword' ? t('sword') : playerWeapon === 'gun' ? t('gun') : t('hammer')}
            </p>
          )}
        </div>
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-2 flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            {t('leaderboard')}
          </h3>
          {leaderboard.length > 0 ? (
            <ul className="text-sm text-gray-700 space-y-1">
              {leaderboard.map((entry, index) => (
                <li key={index} className="py-1">
                  {entry.username}: {entry.score} {t('points')} ({t('in')} {new Date(entry.date).toLocaleString()})
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600">{t('noScores')}</p>
          )}
        </div>
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-2 flex items-center justify-center gap-2">
            <Search className="w-5 h-5 text-blue-600" />
            {t('searchUser')}
          </h3>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchUsername}
              onChange={(e) => setSearchUsername(e.target.value)}
              className="border-gray-300"
            />
            <Button onClick={searchUserScore} className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
              <Search className="w-4 h-4" />
              {t('search')}
            </Button>
          </div>
          {userScore ? (
            <p className="mt-2 text-sm text-green-600">
              {userScore.username}: {userScore.score} {t('points')} ({t('in')} {new Date(userScore.date).toLocaleString()})
            </p>
          ) : (
            searchUsername && <p className="mt-2 text-sm text-red-500">{t('userNotFound')}</p>
          )}
        </div>
        <Link href={`/${locale}`}>
          <Button variant="outline" className="px-6 py-2 text-blue-700 border-blue-600 hover:bg-blue-50 flex items-center gap-2">
            <Home className="w-4 h-4" />
            {t('home')}
          </Button>
        </Link>
      </div>
    </div>
  );
}