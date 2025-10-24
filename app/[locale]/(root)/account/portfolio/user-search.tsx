'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import Link from 'next/link';

interface User {
 username: string;
 nickname: string;
 avatar: string;
 profileUrl: string;
 portfolioName: string;
}

export default function UserSearch() {
 const t = useTranslations('AccountPortfolio');
 const [query, setQuery] = useState('');
 const [users, setUsers] = useState<User[]>([]);

 const handleSearch = async () => {
 if (!query.trim()) {
 toast.error(t('emptyQuery'));
 return;
 }

 try {
 const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/users/search?query=${encodeURIComponent(query)}`);
 const data = await response.json();
 if (data.length > 0) {
 setUsers(data);
 } else {
 toast.info(t('noUsersFound'));
 setUsers([]);
 }
 } catch (error) {
 toast.error(t('operationFailed'));
 }
 };

 return (
 <Card>
 <CardHeader>
 <CardTitle>{t('searchUsers')}</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex gap-2 mb-4">
 <Input
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 placeholder={t('searchPlaceholder')}
 />
 <Button onClick={handleSearch}>{t('search')}</Button>
 </div>
 <div className="grid gap-4">
 {users.map((user) => (
 <Card key={user.username}>
 <CardContent className="flex items-center gap-4">
 {user.avatar && <img src={user.avatar} alt={user.nickname} className="w-12 h-12 rounded-full" />}
 <div>
 <p>{user.nickname || user.username}</p>
 <p>{user.portfolioName}</p>
 <Button asChild>
 <Link href={user.profileUrl}>{t('viewProfile')}</Link>
 </Button>
 </div >
 </CardContent>
 </Card>
 ))}
 </div>
 </CardContent>
 </Card>
 );
}