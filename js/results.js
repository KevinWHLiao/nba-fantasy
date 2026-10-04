/* 2026-27 正規賽真實數據。
   賽季有成績之後，把 SEASON_RESULTS 換成下面這種物件，重新發布，
   大家原本存在瀏覽器裡的預測會自動改成正式排名。
   byName 的鍵要和 js/data.js 的 name 完全一致。
   fppg 用同一套公式：得分 + 1.2*籃板 + 1.5*助攻 + 3*抄截 + 3*阻攻 - 失誤 + 0.5*三分 + 雙十/大三元。

   const SEASON_RESULTS = {
     label: "2026-27 正規賽",
     asOf: "2027-04-15",
     byName: { "Nikola Jokić": { fppg: 64.2 } }
   };
*/
const SEASON_RESULTS = null;
