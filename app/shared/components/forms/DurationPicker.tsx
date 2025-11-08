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
 * Displays a three-column wheel selector (hours / minutes / seconds) inspired by
 * the iOS timer UI. All options are rendered using native selects so the widget
 * remains keyboard and screen-reader accessible.
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
        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            <span>{label}</span>
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
                <WheelSelect
                    ariaLabel="Hours"
                    value={hours}
                    options={HOURS_RANGE}
                    unit="h"
                    onChange={handleHours}
                    disabled={disabled}
                />
                <WheelSelect
                    ariaLabel="Minutes"
                    value={minutes}
                    options={MINUTES_SECONDS_RANGE}
                    unit="m"
                    onChange={handleMinutes}
                    disabled={disabled}
                />
                <WheelSelect
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
        </label>
    );
}

interface WheelSelectProps {
    ariaLabel: string;
    value: number;
    options: number[];
    unit: string;
    disabled?: boolean;
    onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

function WheelSelect({
    ariaLabel,
    value,
    options,
    unit,
    disabled,
    onChange,
}: WheelSelectProps) {
    return (
        <div className="flex flex-col items-center">
            <select
                aria-label={ariaLabel}
                value={value}
                onChange={onChange}
                disabled={disabled}
                    className="scrollbar-thin h-24 w-16 appearance-none rounded-lg border border-gray-100 bg-gradient-to-b from-white to-gray-100 text-center text-base font-semibold text-gray-800 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {options.map((option) => (
                    <option key={option} value={option}>
                        {option.toString().padStart(2, "0")}
                    </option>
                ))}
            </select>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {unit}
            </span>
        </div>
    );
}

export default DurationPicker;

