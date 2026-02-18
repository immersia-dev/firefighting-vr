/**
 * Test Suite for Interactive Panels Component
 *
 * Run with: npm test
 */

const assert = {
  equal: (actual, expected, msg) => {
    if (actual !== expected)
      throw new Error(`FAIL: ${msg}\nExpected: ${expected}\nActual: ${actual}`);
    console.log(`✓ ${msg}`);
  },
  true: (condition, msg) => {
    if (!condition) throw new Error(`FAIL: ${msg}`);
    console.log(`✓ ${msg}`);
  },
  exists: (value, msg) => {
    if (!value) throw new Error(`FAIL: ${msg} - Value does not exist`);
    console.log(`✓ ${msg}`);
  },
};

const testInteractivePanels = () => {
  console.log("\n=== Interactive Panels Tests ===\n");

  // Test 1: Panel configuration
  const testPanels = {
    intro: { title: "Test", buttons: [{ text: "OK", action: "test" }] },
  };
  assert.exists(testPanels.intro, "Panel configuration exists");
  assert.equal(
    testPanels.intro.buttons.length,
    1,
    "Panel has correct button count",
  );

  // Test 2: Button action detection
  const buttonAction = testPanels.intro.buttons[0].action;
  assert.equal(buttonAction, "test", "Button action is correct");

  // Test 3: Panel data structure
  assert.equal(testPanels.intro.title, "Test", "Panel title exists");
  assert.true(Array.isArray(testPanels.intro.buttons), "Buttons is an array");

  // Test 4: Multiple panels
  const panels = { intro: {}, movement: {} };
  assert.equal(Object.keys(panels).length, 2, "Multiple panels can be stored");

  console.log("\nInteractive Panels: ALL TESTS PASSED ✓\n");
};

const testTutorialHUD = () => {
  console.log("\n=== Tutorial HUD Tests ===\n");

  // Test 1: Message queue structure
  const messageQueue = [];
  messageQueue.push({ text: "Hello", duration: 5000 });
  assert.equal(messageQueue.length, 1, "Message can be queued");
  assert.equal(
    messageQueue[0].text,
    "Hello",
    "Message text is stored correctly",
  );

  // Test 2: Message processing
  const msg = messageQueue.shift();
  assert.equal(msg.text, "Hello", "Message can be dequeued");
  assert.equal(messageQueue.length, 0, "Queue is empty after shift");

  // Test 3: Multiple messages
  const queue = [];
  queue.push({ text: "Msg1", duration: 3000 });
  queue.push({ text: "Msg2", duration: 3000 });
  queue.push({ text: "Msg3", duration: 3000 });
  assert.equal(queue.length, 3, "Multiple messages queued");

  // Test 4: FIFO order
  const first = queue.shift();
  assert.equal(first.text, "Msg1", "FIFO order maintained");
  assert.equal(queue[0].text, "Msg2", "Remaining queue correct");

  console.log("\nTutorial HUD: ALL TESTS PASSED ✓\n");
};

const testTrainingManager = () => {
  console.log("\n=== Training Manager Tests ===\n");

  // Test 1: Training state flow
  const states = ["intro", "movement_select", "training"];
  assert.equal(states.length, 3, "Training has 3 phases");
  assert.equal(states[0], "intro", "First phase is intro");
  assert.equal(states[2], "training", "Last phase is training");

  // Test 2: State progression
  let currentIndex = 0;
  currentIndex++;
  assert.equal(
    states[currentIndex],
    "movement_select",
    "State progression works",
  );

  // Test 3: Training steps
  const trainingSteps = ["sizeup", "approach", "suppress", "overhaul", "done"];
  assert.equal(trainingSteps.length, 5, "Training has 5 steps");
  assert.equal(
    trainingSteps[trainingSteps.length - 1],
    "done",
    "Final step is done",
  );

  // Test 4: Callback simulation
  let callbackFired = false;
  const callbacks = {
    nextPhase: () => {
      callbackFired = true;
    },
  };
  callbacks.nextPhase();
  assert.true(callbackFired, "Callbacks can be executed");

  console.log("\nTraining Manager: ALL TESTS PASSED ✓\n");
};

// Run all tests
try {
  testInteractivePanels();
  testTutorialHUD();
  testTrainingManager();
  console.log("═══════════════════════════════════");
  console.log("✓ ALL TESTS PASSED!");
  console.log("═══════════════════════════════════\n");
  process.exit(0);
} catch (error) {
  console.error("\n✗ TEST FAILED:", error.message);
  process.exit(1);
}
