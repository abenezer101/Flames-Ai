import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Builder - Flames',
  description: 'Build your app with AI',
};

export default function BuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
}
