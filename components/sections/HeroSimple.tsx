'use client';
import { FC } from 'react';
interface HeroProps {
  config: { title: string; subtitle: string; backgroundColor: string; image?: string };
}
const HeroSimple: FC<HeroProps> = ({ config }) => (
  <section style={{ backgroundColor: config.backgroundColor }}>
    <h1>{config.title}</h1>
    <p>{config.subtitle}</p>
    {config.image && <img src={config.image} alt="Hero" />}
  </section>
);
export default HeroSimple;