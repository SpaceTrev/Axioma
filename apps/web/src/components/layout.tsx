'use client';

import React from 'react';
import Link from 'next/link';
import { useAuthStore, logout, fetchMe } from '@/lib/store';
import { Button, Badge, Price } from './ui';
import { useEffect } from 'react';

export function Header() {
  const { token, user } = useAuthStore();

  useEffect(() => {
    if (token && !user) {
      fetchMe();
    }
  }, [token, user]);

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-white">Axioma</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              href="/"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white font-medium"
            >
              Markets
            </Link>
            {token && (
              <Link
                href="/portfolio"
                className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white font-medium"
              >
                Portfolio
              </Link>
            )}
            {user?.role === 'ADMIN' && (
              <Link
                href="/admin"
                className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white font-medium"
              >
                Admin
              </Link>
            )}
          </nav>

          {/* Auth */}
          <div className="flex items-center space-x-4">
            {token && user ? (
              <>
                {user.balance && (
                  <div className="hidden sm:block text-sm">
                    <span className="text-gray-500">Balance:</span>{' '}
                    <Price value={user.balance.available} className="font-medium" />
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">{user.email}</span>
                  {user.role === 'ADMIN' && <Badge variant="info">Admin</Badge>}
                </div>
                <Button variant="ghost" size="sm" onClick={logout}>
                  Logout
                </Button>
              </>
            ) : (
              <Link href="/auth">
                <Button size="sm">Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">Axioma</span>
            <span className="text-gray-500 text-sm">• Prediction Markets</span>
          </div>
          <div className="text-sm text-gray-500">
            © {new Date().getFullYear()} Axioma. For educational purposes only.
          </div>
        </div>
      </div>
    </footer>
  );
}
