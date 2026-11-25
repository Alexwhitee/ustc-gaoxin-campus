// 调色板：全部为自选颜色
export const C = {
  grass: ["#7cb85c", "#75b055", "#82bf63", "#6ea851"],
  grassDark: "#5e9245",
  road: "#b8bcc4",
  roadDark: "#a3a8b1",
  roadLine: "#e8eaee",
  sidewalk: "#cfd2d8",
  path: "#cdbfa0",
  pathDark: "#b7a886",
  mown: "#8cc46c", // 路肩修剪亮带
  plaza: "#d8d3c8",
  plazaDark: "#c4beb2",
  water: ["#5aa7d6", "#5b9fce", "#68b3de"],
  waterShore: "#4a8db8",
  waterDeep: "#4890bd",
  sand: "#e5d9a8",
  treeTrunk: "#7a5230",
  tree: ["#3e7d3a", "#468a42", "#356e33"],
  sakura: ["#f2b8cc", "#eb9fb9", "#f7cddd"],
  roofTeaching: "#6b7fbd",
  roofLab: "#7d6bab",
  roofLibrary: "#4f6796",
  roofDorm: "#b5674f",
  roofCanteen: "#c79a4b",
  roofShop: "#c07352",
  roofSports: "#5f9ea0",
  roofService: "#8aa07c",
  roofLandmark: "#9a5a74",
  wall: "#e9e4da",
  wallShade: "#d5cfc2",
  window: "#8fb6cf",
  windowLit: "#ffd98a",
  door: "#6b4a36",
  outline: "#4a4038",
  track: "#c96a4f",
  trackLine: "#f2efe8",
  field: "#63a95e",
  courtBlue: "#5b8fc9",
  courtGreen: "#6aa87a",
  tennis: "#7ba05f",
  lamp: "#ffe9a8",
  label: "#3d3a35",
  labelHalo: "rgba(255,255,255,0.75)",
};

export function roofColor(category: string): string {
  switch (category) {
    case "teaching":
      return C.roofTeaching;
    case "lab":
      return C.roofLab;
    case "library":
      return C.roofLibrary;
    case "dorm":
      return C.roofDorm;
    case "canteen":
      return C.roofCanteen;
    case "shop":
      return C.roofShop;
    case "sports":
      return C.roofSports;
    case "service":
      return C.roofService;
    case "landmark":
      return C.roofLandmark;
    default:
      return C.roofTeaching;
  }
}
