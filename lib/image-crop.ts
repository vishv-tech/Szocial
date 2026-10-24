export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const PROFILE_IMAGE_OUTPUT_SIZE = 512;
export const PROFILE_IMAGE_OUTPUT_TYPE = "image/jpeg";
export const PROFILE_IMAGE_OUTPUT_QUALITY = 0.85;

const SUPPORTED_PROFILE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export type ProfileImageCropSettings = {
  cropSize: number;
  zoom: number;
  positionX: number;
  positionY: number;
};

export function validateProfileImageFile(file: File) {
  if (!SUPPORTED_PROFILE_IMAGE_TYPES.has(file.type)) {
    return "Please select a valid image file.";
  }

  if (!file.size) return "The image file is empty.";

  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    return "Image must be under 2 MB.";
  }

  return "";
}

export function loadImageFromFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Image file could not be read."));
    };
    reader.onerror = reader.onabort = () => reject(new Error("Image file could not be read."));
    try{reader.readAsDataURL(file);}catch{reject(new Error("Image file could not be read."));}
  });
}

export function loadImageElement(src: string, signal?:AbortSignal) {
  return new Promise<HTMLImageElement>((resolve,reject)=>{
    const image=new Image();let finished=false;
    const cleanup=()=>{clearTimeout(timer);image.onload=null;image.onerror=null;signal?.removeEventListener('abort',abort);};
    const fail=(message:string)=>{if(finished)return;finished=true;cleanup();image.src='';reject(new Error(message));};
    const abort=()=>fail('Image loading was cancelled.');
    const timer=setTimeout(()=>fail('Image decoding timed out. Try a smaller photo.'),10000);
    image.onload=()=>{
      if(finished)return;
      const width=image.naturalWidth,height=image.naturalHeight;
      if(!width||!height||!Number.isFinite(width*height))return fail('Image has no readable dimensions.');
      if(width*height>25000000||width>10000||height>10000)return fail('Image dimensions are too large. Choose a photo under 25 megapixels.');
      finished=true;cleanup();resolve(image);
    };
    image.onerror=()=>fail('Could not decode this image. Choose a valid JPEG, PNG or WebP photo.');
    if(signal?.aborted)return abort();signal?.addEventListener('abort',abort,{once:true});
    image.src=src;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getProfileImageBaseScale({
  cropSize,
  naturalHeight,
  naturalWidth
}: {
  cropSize: number;
  naturalHeight: number;
  naturalWidth: number;
}) {
  return Math.max(cropSize / naturalWidth, cropSize / naturalHeight);
}

export function getProfileImageRenderedSize({
  cropSize,
  naturalHeight,
  naturalWidth,
  zoom
}: {
  cropSize: number;
  naturalHeight: number;
  naturalWidth: number;
  zoom: number;
}) {
  const baseScale = getProfileImageBaseScale({
    cropSize,
    naturalHeight,
    naturalWidth
  });

  return {
    baseHeight: naturalHeight * baseScale,
    baseScale,
    baseWidth: naturalWidth * baseScale,
    renderedHeight: naturalHeight * baseScale * zoom,
    renderedWidth: naturalWidth * baseScale * zoom
  };
}

export function clampProfileImagePosition(
  position: { x: number; y: number },
  settings: {
    cropSize: number;
    naturalHeight: number;
    naturalWidth: number;
    zoom: number;
  }
) {
  const { renderedHeight, renderedWidth } =
    getProfileImageRenderedSize(settings);
  const maxX = Math.max(0, (renderedWidth - settings.cropSize) / 2);
  const maxY = Math.max(0, (renderedHeight - settings.cropSize) / 2);

  return {
    x: maxX ? clamp(position.x, -maxX, maxX) : 0,
    y: maxY ? clamp(position.y, -maxY, maxY) : 0
  };
}

function getProfileImageSourceRect({
  cropSize,
  naturalHeight,
  naturalWidth,
  positionX,
  positionY,
  zoom
}: ProfileImageCropSettings & {
  naturalHeight: number;
  naturalWidth: number;
}) {
  const scale =
    getProfileImageBaseScale({ cropSize, naturalHeight, naturalWidth }) * zoom;
  const renderedWidth = naturalWidth * scale;
  const renderedHeight = naturalHeight * scale;
  const imageLeft = cropSize / 2 + positionX - renderedWidth / 2;
  const imageTop = cropSize / 2 + positionY - renderedHeight / 2;
  const sourceSize = cropSize / scale;

  return {
    height: sourceSize,
    width: sourceSize,
    x: clamp(-imageLeft / scale, 0, Math.max(0, naturalWidth - sourceSize)),
    y: clamp(-imageTop / scale, 0, Math.max(0, naturalHeight - sourceSize))
  };
}

export async function cropImageToSquare(
  dataUrl: string,
  settings: ProfileImageCropSettings,
  outputSize = PROFILE_IMAGE_OUTPUT_SIZE
) {
  if(![settings.cropSize,settings.zoom,settings.positionX,settings.positionY,outputSize].every(Number.isFinite)||settings.cropSize<=0||settings.zoom<1||settings.zoom>4||outputSize<=0||outputSize>4096)throw new Error('Invalid crop dimensions.');
  const image = await loadImageElement(dataUrl);
  const cropSize = Math.max(1, settings.cropSize);
  const sourceRect = getProfileImageSourceRect({
    ...settings,
    cropSize,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth
  });

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputSize, outputSize);
  context.drawImage(
    image,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    0,
    0,
    outputSize,
    outputSize
  );

  const output=canvas.toDataURL(PROFILE_IMAGE_OUTPUT_TYPE,PROFILE_IMAGE_OUTPUT_QUALITY);
  if(!output.startsWith('data:image/jpeg;base64,')||output.length<100)throw new Error('The cropped photo could not be created. Try a smaller image.');
  return output;
}
