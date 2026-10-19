// Photos are shrunk on the phone before they're stored or sent, so storage stays small and Claude reads fewer tokens.

export function fileToDataUrl(file, max = 768, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      const g = cv.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that photo.")); };
    img.src = url;
  });
}

export async function squareAvatar(file) {
  const src = await fileToDataUrl(file, 600);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height), cv = document.createElement("canvas");
      cv.width = cv.height = 192;
      cv.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 192, 192);
      resolve(cv.toDataURL("image/jpeg", 0.85));
    };
    img.src = src;
  });
}

/* Ask for one or more photos (camera or camera roll). */
export function pickPhotos({ multiple = false, capture } = {}) {
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*"; inp.multiple = multiple;
    if (capture) inp.capture = capture;
    inp.style.display = "none";
    inp.onchange = () => { resolve([...inp.files]); inp.remove(); };
    inp.oncancel = () => { resolve([]); inp.remove(); };
    document.body.append(inp);
    inp.click();
  });
}
