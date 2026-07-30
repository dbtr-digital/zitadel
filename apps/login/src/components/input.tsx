"use client";

import { getComponentRoundness } from "@/lib/theme";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { clsx } from "clsx";
import { ChangeEvent, DetailedHTMLProps, forwardRef, InputHTMLAttributes, ReactNode, useId, useState } from "react";

export type TextInputProps = DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> & {
  label: string;
  suffix?: string;
  placeholder?: string;
  defaultValue?: string;
  error?: string | ReactNode;
  success?: string | ReactNode;
  disabled?: boolean;
  onChange?: (value: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (value: ChangeEvent<HTMLInputElement>) => void;
  roundness?: string; // Allow override via props
};

const styles = (error: boolean, disabled: boolean, roundnessClasses: string = "rounded-md", password: boolean = false) =>
  clsx(
    {
      "h-[40px] mb-[2px] p-[7px] bg-input-light-background dark:bg-input-dark-background transition-colors duration-300 w-full grow": true,
      "border border-input-light-border dark:border-input-dark-border hover:border-black hover:dark:border-white focus:border-primary-light-500 focus:dark:border-primary-dark-500": true,
      "focus:outline-none focus:ring-0 text-base text-black dark:text-white placeholder:italic placeholder-gray-700 dark:placeholder-gray-700": true,
      "pr-11": password,
      "border border-warn-light-500 dark:border-warn-dark-500 hover:border-warn-light-500 hover:dark:border-warn-dark-500 focus:border-warn-light-500 focus:dark:border-warn-dark-500":
        error,
      "pointer-events-none text-gray-500 dark:text-gray-800 border border-input-light-border dark:border-input-dark-border hover:border-light-hoverborder hover:dark:border-hoverborder cursor-default":
        disabled,
    },
    roundnessClasses, // Apply the full roundness classes directly
  );

// Helper function to get default input roundness from theme
function getDefaultInputRoundness(): string {
  return getComponentRoundness("input");
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      label,
      placeholder,
      defaultValue,
      suffix,
      required = false,
      error,
      disabled,
      success,
      onChange,
      onBlur,
      roundness,
      type,
      id,
      ...props
    },
    ref,
  ) => {
    // Use theme-based roundness if not explicitly provided
    const actualRoundness = roundness || getDefaultInputRoundness();
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const isPassword = type === "password";
    const [passwordVisible, setPasswordVisible] = useState(false);

    return (
      <div className="text-12px text-input-light-label dark:text-input-dark-label relative flex flex-col">
        <label htmlFor={inputId} className={`mb-1 leading-3 ${error ? "text-warn-light-500 dark:text-warn-dark-500" : ""}`}>
          {label} {required && "*"}
        </label>
        <div className="relative flex">
          <input
            suppressHydrationWarning
            ref={ref}
            id={inputId}
            className={styles(!!error, !!disabled, actualRoundness, isPassword)}
            defaultValue={defaultValue}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            autoComplete={props.autoComplete ?? "off"}
            onChange={(e) => onChange && onChange(e)}
            onBlur={(e) => onBlur && onBlur(e)}
            type={isPassword && passwordVisible ? "text" : type}
            {...props}
          />

          {isPassword && (
            <button
              type="button"
              className="focus:ring-primary-light-500 dark:focus:ring-primary-dark-500 absolute inset-y-0 right-0 mb-[2px] flex w-10 items-center justify-center rounded-r-md text-gray-600 transition-colors hover:text-black focus:ring-2 focus:outline-none focus:ring-inset dark:text-gray-300 dark:hover:text-white"
              aria-label={label}
              aria-pressed={passwordVisible}
              title={label}
              disabled={disabled}
              onClick={() => setPasswordVisible((visible) => !visible)}
              data-testid="password-visibility-button"
            >
              {passwordVisible ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          )}

          {suffix && (
            <span
              className={clsx(
                "bg-background-light-500 dark:bg-background-dark-500 absolute top-1/2 right-[3px] z-30 -translate-y-1/2 transform p-2",
                // Extract just the roundness part for the suffix (no padding)
                actualRoundness.split(" ")[0], // Take only the first part (rounded-full, rounded-md, etc.)
              )}
            >
              @{suffix}
            </span>
          )}
        </div>
        <div className="leading-14.5px h-14.5px text-12px text-warn-light-500 dark:text-warn-dark-500 flex flex-row items-center">
          <span>{error ? error : " "}</span>
        </div>

        {success && (
          <div className="text-md mt-1 flex flex-row items-center text-green-500">
            <CheckCircleIcon className="h-4 w-4" />
            <span className="ml-1">{success}</span>
          </div>
        )}
      </div>
    );
  },
);
