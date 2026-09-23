export type CatPhoto = {
  id: string;
  name: string;
  image: string;
  sourcePage: string;
  photographer: string;
  mood: "sleepy" | "sweet" | "serious" | "curious";
  objectPosition?: string;
};

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&fm=jpg&q=82&w=1200`;

/**
 * Curated real-cat pool.
 * All source photos were published as free-to-use Unsplash photos.
 * We keep the source page + photographer here for auditability/credits.
 */
export const CATS: CatPhoto[] = [
  { id: "momo", name: "摸摸", image: img("photo-1445499348736-29b6cdfc03b9"), sourcePage: "https://unsplash.com/photos/close-up-photo-of-kitten-lying-on-white-textile-iYQC9xWMvw4", photographer: "freddie marriage", mood: "sweet", objectPosition: "50% 48%" },
  { id: "xuegao", name: "雪糕", image: img("photo-1572590285030-0ae6a4715671"), sourcePage: "https://unsplash.com/photos/white-cat-fVNyjet1CXY", photographer: "Leonsa", mood: "curious", objectPosition: "50% 42%" },
  { id: "naicha", name: "奶茶", image: img("photo-1577239559255-12a0a0fb92eb"), sourcePage: "https://unsplash.com/photos/white-cat-TVu6zNbZLIM", photographer: "Jem Sahagun", mood: "sleepy", objectPosition: "50% 50%" },
  { id: "lanmei", name: "蓝莓", image: img("photo-1721472759580-45b18b23fa26"), sourcePage: "https://unsplash.com/photos/a-close-up-of-a-cat-with-blue-eyes-IjhIsWD3j_w", photographer: "Matthew Fainman", mood: "curious", objectPosition: "50% 43%" },
  { id: "heiqiao", name: "黑巧", image: img("photo-1556977883-533cd9c5ad0b"), sourcePage: "https://unsplash.com/photos/black-cat-OK8tU2JlT3c", photographer: "Sas Kia", mood: "sleepy", objectPosition: "50% 46%" },
  { id: "juzi", name: "橘子", image: img("photo-1752614654796-92a7d313050b"), sourcePage: "https://unsplash.com/photos/a-close-up-of-an-orange-cat-gazing-upwards-iRz1PrXvMNQ", photographer: "Gleb Khodiakov", mood: "curious", objectPosition: "50% 46%" },
  { id: "songbing", name: "松饼", image: img("photo-1765289272071-e8b39fa0a33d"), sourcePage: "https://unsplash.com/photos/close-up-of-a-fluffy-orange-cats-face-osjohhLo7JA", photographer: "Jim DeLillo", mood: "sweet", objectPosition: "50% 46%" },
  { id: "mianhua", name: "棉花", image: img("photo-1670182448486-63cb707896ed"), sourcePage: "https://unsplash.com/photos/a-cat-sleeping-on-a-bed-9Kcxh6y3Oyw", photographer: "Clay Elliot", mood: "sleepy", objectPosition: "50% 53%" },
  { id: "buding", name: "布丁", image: img("photo-1658142692469-708495b65394"), sourcePage: "https://unsplash.com/photos/a-cat-lying-down-jIAPTWnW1pk", photographer: "ün LIU", mood: "sweet", objectPosition: "50% 48%" },
  { id: "huahua", name: "花花", image: img("photo-1703182390020-eff7af5fcdff"), sourcePage: "https://unsplash.com/photos/a-close-up-of-a-cat-sleeping-with-its-eyes-closed-9nDxjEtZL6s", photographer: "Pranshu Patel", mood: "sleepy", objectPosition: "50% 49%" },
  { id: "xiaohu", name: "小虎", image: img("photo-1663000386692-7f6293394d80"), sourcePage: "https://unsplash.com/photos/a-cat-lying-down-YMxupzm4Kvk", photographer: "John Smith", mood: "serious", objectPosition: "50% 48%" },
  { id: "doudou", name: "豆豆", image: img("photo-1639121368489-5769b42ae13a"), sourcePage: "https://unsplash.com/photos/a-cat-standing-on-the-side-of-a-road-gsvsrISELzc", photographer: "Yoo hoo", mood: "serious", objectPosition: "50% 45%" },
];

export function pickCat(excludeId?: string) {
  const pool = CATS.filter((cat) => cat.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)] ?? CATS[0];
}
