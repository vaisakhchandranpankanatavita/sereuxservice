/* The start/completion-code popup always goes first; the rating sheet waits until it is closed, so two modals never stack. */
let otpOpen = false;
export const setOtpOpen = (v: boolean) => { otpOpen = v; };
export const isOtpOpen = () => otpOpen;
