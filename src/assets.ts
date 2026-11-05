import type { ImageSourcePropType } from 'react-native';
import type { Frame } from './types';

export const AVATARS: Record<string, ImageSourcePropType> = {
  a01: require('../assets/avatars/a01.png'),
  a02: require('../assets/avatars/a02.png'),
  a03: require('../assets/avatars/a03.png'),
  a04: require('../assets/avatars/a04.png'),
  a05: require('../assets/avatars/a05.png'),
  a06: require('../assets/avatars/a06.png'),
  a07: require('../assets/avatars/a07.png'),
  a08: require('../assets/avatars/a08.png'),
  a09: require('../assets/avatars/a09.png'),
  a10: require('../assets/avatars/a10.png'),
  a11: require('../assets/avatars/a11.png'),
  a12: require('../assets/avatars/a12.png'),
  a13: require('../assets/avatars/a13.png'),
  a14: require('../assets/avatars/a14.png'),
  a15: require('../assets/avatars/a15.png'),
  a16: require('../assets/avatars/a16.png'),
};
export const AVATAR_KEYS = Object.keys(AVATARS);
export const avatarSource = (key?: string) => AVATARS[key ?? ''] ?? AVATARS.a01;

export const FRAMES: Record<Exclude<Frame, 'none'>, ImageSourcePropType> = {
  lion: require('../assets/art/frame-lion.png'),
  wolf: require('../assets/art/frame-wolf.png'),
};

export const CRESTS: Record<Exclude<Frame, 'none'>, ImageSourcePropType> = {
  lion: require('../assets/art/crest-lion.png'),
  wolf: require('../assets/art/crest-wolf.png'),
};

export const COVERS: Record<string, ImageSourcePropType> = {
  royal: require('../assets/covers/royal.jpg'),
  neon: require('../assets/covers/neon.jpg'),
  galaxy: require('../assets/covers/galaxy.jpg'),
  city: require('../assets/covers/city.jpg'),
  sunset: require('../assets/covers/sunset.jpg'),
  ocean: require('../assets/covers/ocean.jpg'),
};
export const THEME_KEYS = Object.keys(COVERS);
export const coverSource = (key: string) => COVERS[key] ?? COVERS.royal;

export const GIFT_ICONS: Record<string, ImageSourcePropType> = {
  heart: require('../assets/gifts/heart.png'),
  rose: require('../assets/gifts/rose.png'),
  ring: require('../assets/gifts/ring.png'),
  rocket: require('../assets/gifts/rocket.png'),
  crown: require('../assets/gifts/crown.png'),
  wolf: require('../assets/gifts/wolf.png'),
  lion: require('../assets/gifts/lion.png'),
};
export const giftIcon = (key: string) => GIFT_ICONS[key] ?? GIFT_ICONS.heart;

export const ART = {
  throne: require('../assets/art/throne.png') as ImageSourcePropType,
  crown: require('../assets/art/hero-crown.png') as ImageSourcePropType,
  mark: require('../assets/brand/mark.png') as ImageSourcePropType,
};
