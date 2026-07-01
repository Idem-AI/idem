// Test trigger: Chart deployment pipeline (Update 2)
import { toast } from 'svelte-sonner';

export const notify = (message: string): void => {
  toast(message);
};

export const prompt = (message: string): boolean => {
  return confirm(message);
};
