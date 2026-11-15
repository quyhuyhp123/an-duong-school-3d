// Used by the browser and by traversal tests against the exported school geometry.
export const CHARACTER_HALF_HEIGHT = .55;
export const CHARACTER_RADIUS = .28;
export function createController(world) {
  const controller = world.createCharacterController(.015);
  controller.enableAutostep(.27, .18, false);
  controller.enableSnapToGround(.3);
  controller.setMaxSlopeClimbAngle(Math.PI / 3);
  controller.setMinSlopeSlideAngle(Math.PI / 3 + .05);
  return controller;
}
export function moveCharacter({body, collider, controller, state, direction, speed, jump, dt}) {
  const grounded = controller.computedGrounded();
  if (grounded && state.vertical <= 0) state.vertical = -.3;
  if (jump && !state.jumpHeld && grounded) state.vertical = 5.5;
  state.jumpHeld = jump;
  state.vertical = Math.max(-25, state.vertical - 16 * dt);
  controller.computeColliderMovement(collider, {
    x: direction.x * speed * dt,
    y: state.vertical * dt,
    z: direction.z * speed * dt,
  });
  const movement = controller.computedMovement();
  const p = body.translation();
  body.setNextKinematicTranslation({x:p.x+movement.x,y:p.y+movement.y,z:p.z+movement.z});
  if (controller.computedGrounded() && state.vertical < 0) state.vertical = -.3;
  return movement;
}
