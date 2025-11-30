// Time-based greeting utility

const greetings = {
  morning: [
    "Good morning! What should we dive into today?",
    "Rise and shine! Ready to create do awesome?",
    "Top of the morning to you! What's on the agenda?",
    "Coffee? Check. Motivation? Check. Let's go!",
    "New day, new opportunities. Where shall we start?",
    "Morning! Let's make today productive.",
    "Hello there! Ready to conquer the day?",
    "Fresh start. What are we working on?",
    "Good morning! Let's get the ball rolling.",
    "Wakey wakey! Time to do something great.",
    "The early bird gets the worm. What's the plan?",
    "Sun's up, systems go. How can I help?",
    "Ready to kickstart the day?",
    "Morning energy levels: 100%. Let's work.",
    "Hope you slept well! Let's get to it.",
    "Carpe Diem! What's the first task?",
    "Grab your beverage of choice. It's go time.",
    "Good morning! Let's make some progress.",
    "Feeling fresh? Let's tackle that to-do list.",
    "Up and at 'em! Let's build something cool.",
    "Morning! The coffee is brewing, let's get started.",
    "A fresh day for fresh ideas. What's first?",
    "Good morning! Let's turn plans into action.",
    "Sunlight and success. Let's make it happen."
  ],
  afternoon: [
    "Good afternoon! What can I help you with?",
    "Hope your day is going well. Need a hand?",
    "Afternoon slump? Not us! Let's keep moving.",
    "Halfway through the day! What's next?",
    "Keeping the momentum going. What do you need?",
    "Good afternoon! Ready for round two?",
    "Powering through the afternoon. How can I assist?",
    "Hope the morning was productive. Let's continue.",
    "Lunch break is over, let's get back in the zone.",
    "Good afternoon! Still going strong?",
    "Need a spark of inspiration this afternoon?",
    "The day is still young. What's the focus?",
    "Afternoon check-in: What are we solving?",
    "Turning coffee into productivity. How about you?",
    "Let's finish the day strong. What's up?",
    "Good afternoon! Let's crush some goals.",
    "Mid-day motivation coming your way!",
    "Staying focused? Let me know what you need.",
    "Good afternoon! Let's keep the flow state alive.",
    "Time to tackle the afternoon tasks.",
    "Afternoon! Let's keep the creative juices flowing.",
    "Good afternoon! Time to crush those goals.",
    "Refueling for the second half. What's the mission?",
    "Afternoon vibes. Let's make magic happen.",
    "Sun's high, spirits high. What are we doing?"
  ],
  evening: [
    "Good evening! Ready to get things done?",
    "Wrapping up the day, or just getting started?",
    "Evening mode activated. What's the plan?",
    "Sun's down, screens up. What are we making?",
    "Good evening! How was your day?",
    "Time for some peaceful productivity.",
    "Unwinding with some work? How can I help?",
    "Good evening! Let's make the most of these hours.",
    "Late shift? I'm here to help.",
    "Good evening! Still plenty of time to achieve greatness.",
    "Relaxed focus. What should we look at?",
    "Checking in for the evening shift.",
    "Good evening! Need to clear the backlog?",
    "Quiet evening, perfect for focusing.",
    "Ready for a final push today?",
    "Good evening! Let's tie up some loose ends.",
    "Reflecting on the day, or planning for tomorrow?",
    "Evening inspiration strikes! What is it?",
    "Good evening! Let's work into the sunset.",
    "Hope you had a good day. Let's continue.",
    "Good evening! Let's wind down with some wins.",
    "Evening! The perfect time for deep work.",
    "Stars are coming out. Let's shine.",
    "Good evening! Let's make every keystroke count.",
    "Twilight focus. What's on your mind?"
  ],
  night: [
    "Burning the midnight oil? Let's make it count! 🌙",
    "Late night inspiration? I'm listening.",
    "Night owl mode: ON. What are we working on?",
    "Everything is quieter at night. Perfect for focus.",
    "Burning the candle at both ends? Let's be efficient.",
    "Still up? Let's get this done.",
    "Midnight hacking session? I'm in.",
    "Don't forget to sleep eventually! But for now, let's work.",
    "Silence is golden. Let's write some code.",
    "Late night grind. How can I assist?",
    "Fighting the sandman? Let's stay productive.",
    "Greeting from the graveyard shift.",
    "Just you, me, and the screen. Let's do this.",
    "Late nights lead to breakthroughs. Ready?",
    "Psst... it's late. But I'm ready if you are.",
    "Moonlight productivity. What's the task?",
    "Powered by caffeine and determination. Let's go.",
    "still working while the world dreams.",
    "Late night thoughts? Let's capture them.",
    "The world sleeps, but we build. What's next?",
    "Midnight oil burning bright. Let's go.",
    "Quiet hours, loud results. What's the plan?",
    "Into the night we go. Ready for anything."
  ]
};

/**
 * Get a random item from an array
 */
const getRandomGreeting = (list: string[]): string => {
  return list[Math.floor(Math.random() * list.length)] ?? list[0] ?? '';
};

/**
 * Get a time-based greeting based on the current hour
 * - Morning: 5 AM - 12 PM
 * - Afternoon: 12 PM - 5 PM
 * - Evening: 5 PM - 10 PM
 * - Night: 10 PM - 5 AM
 */
export const getTimeBasedGreeting = (): string => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return getRandomGreeting(greetings.morning);
  } else if (hour >= 12 && hour < 17) {
    return getRandomGreeting(greetings.afternoon);
  } else if (hour >= 17 && hour < 22) {
    return getRandomGreeting(greetings.evening);
  } else {
    return getRandomGreeting(greetings.night);
  }
};
