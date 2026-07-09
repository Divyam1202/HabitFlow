export function mapCategoryToChannel(category: string): string {
  const cat = (category || '').toLowerCase();
  if (cat.includes('health') || cat.includes('gym') || cat.includes('sport') || cat.includes('hydration') || cat.includes('diet') || cat.includes('water')) return 'health';
  if (cat.includes('career') || cat.includes('building') || cat.includes('work') || cat.includes('project')) return 'career';
  if (cat.includes('growth') || cat.includes('read') || cat.includes('learn') || cat.includes('code') || cat.includes('study')) return 'growth';
  if (cat.includes('spiritual') || cat.includes('yoga') || cat.includes('meditat') || cat.includes('pray') || cat.includes('mindfulness')) return 'spiritual';
  if (cat.includes('home') || cat.includes('laundry') || cat.includes('clean') || cat.includes('chore')) return 'home';
  return 'growth';
}

export function buildNotificationCopy(
  habitName: string,
  category: string
): { title: string; body: string } {
  const catChannel = mapCategoryToChannel(category);
  const emoji =
    catChannel === 'health' ? '🏋️' :
    catChannel === 'career' ? '🚀' :
    catChannel === 'growth' ? '📖' :
    catChannel === 'spiritual' ? '🧘' :
    catChannel === 'home' ? '🏠' : '⭐';

  return {
    title: `${emoji} ${habitName}`,
    body: `Time to ${habitName.toLowerCase()}. Your streak is counting on you.`,
  };
}