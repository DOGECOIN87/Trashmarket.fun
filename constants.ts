import { ChartPoint, ActivityItem } from './types';

// Generate somewhat realistic looking chart data
export const generateChartData = (basePrice: number): ChartPoint[] => {
    const points: ChartPoint[] = [];
    let currentPrice = basePrice * 0.8;
    const now = new Date();
    for(let i=30; i>=0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        // Random walk
        currentPrice = currentPrice * (1 + (Math.random() * 0.1 - 0.04));
        points.push({
            time: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            price: parseFloat(currentPrice.toFixed(2))
        });
    }
    return points;
}

export const generateActivity = (collectionId: string): ActivityItem[] => {
    return Array.from({ length: 15 }).map((_, i) => {
        const isSale = Math.random() > 0.3;
        return {
            id: `act-${i}`,
            type: isSale ? 'sale' : 'list',
            price: parseFloat((Math.random() * 20).toFixed(2)),
            from: `8x...${Math.floor(Math.random() * 999)}`,
            to: isSale ? `4k...${Math.floor(Math.random() * 999)}` : undefined,
            time: `${Math.floor(Math.random() * 59) + 1}m ago`,
            image: `https://picsum.photos/seed/${collectionId}${i}/100/100`,
            name: `Item #${Math.floor(Math.random() * 5000)}`
        };
    });
};