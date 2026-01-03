import React from "react";

/**
 * Props that configure the `DurationPicker` wheel selector.
 */
export interface DurationPickerProps {
    /**
     * Total duration expressed in whole seconds.
     */
    valueSeconds: number;
    /**
     * Invoked when the duration changes. Receives the total seconds.
     */
    onChange: (seconds: number) => void;
    /**
     * Accessible label shown above the picker.
     */
    label: string;
    /**
     * Optional element rendered below the picker for helper copy.
     */
    helperText?: React.ReactNode;
    /**
     * Determines whether the picker is interactive.
     */
    disabled?: boolean;
}

const HOURS_RANGE = Array.from({ length: 24 }, (_, index) => index);
const MINUTES_SECONDS_RANGE = Array.from({ length: 60 }, (_, index) => index);

function clampSeconds(seconds: number): number {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return 0;
    }
    return Math.min(seconds, 23 * 60 * 60 + 59 * 60 + 59);
}

function toParts(totalSeconds: number) {
    const clamped = clampSeconds(totalSeconds);
    const hours = Math.floor(clamped / 3600);
    const minutes = Math.floor((clamped % 3600) / 60);
    const seconds = clamped % 60;
    return { hours, minutes, seconds };
}

function partsToSeconds(hours: number, minutes: number, seconds: number) {
    return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Displays a compact inline time picker with minimal Apple-style design.
 */
export function DurationPicker({
    valueSeconds,
    onChange,
    label,
    helperText,
    disabled = false,
}: DurationPickerProps) {
    const { hours, minutes, seconds } = toParts(valueSeconds);

    const handleHours = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const nextHours = Number(event.target.value);
        onChange(partsToSeconds(nextHours, minutes, seconds));
    };

    const handleMinutes = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const nextMinutes = Number(event.target.value);
        onChange(partsToSeconds(hours, nextMinutes, seconds));
    };

    const handleSeconds = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const nextSeconds = Number(event.target.value);
        onChange(partsToSeconds(hours, minutes, nextSeconds));
    };

    return (
        <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">{label}</span>
            <div className="flex items-center gap-2">
                <CompactSelect
                    ariaLabel="Hours"
                    value={hours}
                    options={HOURS_RANGE}
                    unit="h"
                    onChange={handleHours}
                    disabled={disabled}
                />
                <span className="text-gray-400">:</span>
                <CompactSelect
                    ariaLabel="Minutes"
                    value={minutes}
                    options={MINUTES_SECONDS_RANGE}
                    unit="m"
                    onChange={handleMinutes}
                    disabled={disabled}
                />
                <span className="text-gray-400">:</span>
                <CompactSelect
                    ariaLabel="Seconds"
                    value={seconds}
                    options={MINUTES_SECONDS_RANGE}
                    unit="s"
                    onChange={handleSeconds}
                    disabled={disabled}
                />
            </div>
            {helperText ? (
                <span className="text-xs font-normal text-gray-500">
                    {helperText}
                </span>
            ) : null}
        </div>
    );
}

interface CompactSelectProps {
    ariaLabel: string;
    value: number;
    options: number[];
    unit: string;
    disabled?: boolean;
    onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

function CompactSelect({
    ariaLabel,
    value,
    options,
    unit,
    disabled,
    onChange,
}: CompactSelectProps) {
    return (
        <div className="relative inline-flex items-center">
            <select
                aria-label={ariaLabel}
                value={value}
                onChange={onChange}
                disabled={disabled}
                className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-6 text-sm font-medium text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 hover:bg-gray-50 transition-colors"
            >
                {options.map((option) => (
                    <option key={option} value={option}>
                        {option.toString().padStart(2, "0")}
                    </option>
                ))}
            </select>
            <span className="absolute right-2 text-[10px] font-medium uppercase text-gray-400 pointer-events-none">
                {unit}
            </span>
        </div>
    );
}

export default DurationPicker;

