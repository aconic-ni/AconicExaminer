
"use client"
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';

interface ChartData {
  name: string;
  value: number;
}

interface AforoPieChartCardProps {
  title: string;
  description: string;
  data: ChartData[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(210 20% 90%)',
];

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null; // Don't render label for small slices

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-semibold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};


export const AforoPieChartCard: React.FC<AforoPieChartCardProps> = ({ title, description, data }) => {

  const totalValue = useMemo(() => data.reduce((acc, entry) => acc + entry.value, 0), [data]);
  const filteredData = data.filter(entry => entry.value > 0).sort((a,b) => b.value - a.value);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {totalValue === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No hay datos para mostrar.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie
                        data={filteredData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomizedLabel}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                    >
                        {filteredData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                    />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="space-y-2">
                <h4 className="font-semibold text-center">Total: {totalValue}</h4>
                 <ScrollArea className="h-[200px]">
                    <div className="space-y-2 pr-4">
                    {filteredData
                        .map((entry, index) => {
                            const percentage = totalValue > 0 ? (entry.value / totalValue) * 100 : 0;
                            return (
                                <div key={index} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                        <span className="truncate">{entry.name}</span>
                                    </div>
                                    <div className="font-medium text-right">
                                        <span>{entry.value}</span>
                                        <Badge variant="secondary" className="ml-2 w-14 justify-center">{percentage.toFixed(1)}%</Badge>
                                    </div>
                                </div>
                            )
                    })}
                    </div>
                </ScrollArea>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
