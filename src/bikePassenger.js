// Avatar and bicycle face local +Z. Passenger keeps the driver's heading.
export function rearSeat(driver){const yaw=driver.yaw??0;return {x:driver.x-Math.sin(yaw)*.65,y:driver.y-.05,z:driver.z-Math.cos(yaw)*.65};}
