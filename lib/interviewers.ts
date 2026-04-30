export interface Interviewer {
  id: string;
  name: string;
  role: string;
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  faceId: string;
  imageUrl: string;
}

export const INTERVIEWERS: Interviewer[] = [
  {
    id: "kim",
    name: "Sabour",
    role: "CTO",
    voice: "onyx",
    faceId: "7e74d6e7-d559-4394-bd56-4923a3ab75ad",
    imageUrl: "/interviewers/Sabour.png",
  },
  {
    id: "lee",
    name: "Tina",
    role: "HR 매니저",
    voice: "nova",
    faceId: "cace3ef7-a4c4-425d-a8cf-a5358eb0c427",
    imageUrl: "/interviewers/Tina.png",
  },
  {
    id: "park",
    name: "Chimpan",
    role: "Tech Lead",
    voice: "echo",
    faceId: "6926a39d-638b-49c5-9328-79efa034e9a4",
    imageUrl: "/interviewers/Chimpan.png",
  },
];

export function getInterviewer(id: string): Interviewer {
  return INTERVIEWERS.find((i) => i.id === id) ?? INTERVIEWERS[0];
}
