
"use client"

import * as React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar as CalendarIcon, Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "../ui/input"

interface DateTimePickerProps extends React.HTMLAttributes<HTMLDivElement> {
    date: Date | undefined | null;
    onDateChange: (date: Date | undefined | null) => void;
    disabled?: boolean;
}

export function DatePickerWithTime({
  className,
  date,
  onDateChange,
  disabled = false,
}: DateTimePickerProps) {
  const [time, setTime] = React.useState(date ? format(date, "HH:mm") : "00:00");
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
        onDateChange(null);
        return;
    }
    const [hours, minutes] = time.split(':').map(Number);
    selectedDate.setHours(hours, minutes);
    onDateChange(selectedDate);
    // Keep popover open to adjust time
  };
  
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTime(newTime);
    if (date) {
        const newDate = new Date(date);
        const [hours, minutes] = newTime.split(':').map(Number);
        if(!isNaN(hours) && !isNaN(minutes)) {
            newDate.setHours(hours, minutes);
            onDateChange(newDate);
        }
    }
  }

  return (
    <div className={cn("grid gap-2", className)}>
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          disabled={disabled}
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP, hh:mm a", { locale: es }) : <span>Seleccione fecha y hora</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date ?? undefined}
          onSelect={handleDateSelect}
          initialFocus
          locale={es}
        />
        <div className="p-3 border-t border-border flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground"/>
            <Input 
                type="time"
                value={time}
                onChange={handleTimeChange}
                className="w-full"
            />
        </div>
      </PopoverContent>
    </Popover>
    </div>
  )
}
