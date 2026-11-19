// The school follows Vietnam time, regardless of the player's device timezone.
export const DRUM_TIME_ZONE='Asia/Ho_Chi_Minh';
export function isSchoolDrumTime(now=Date.now()){
 const vietnam=new Date(now+7*60*60*1000);
 const minute=vietnam.getUTCHours()*60+vietnam.getUTCMinutes();
 return (minute>=8*60&&minute<=12*60)||(minute>=14*60&&minute<=17*60);
}
