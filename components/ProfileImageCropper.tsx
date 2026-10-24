"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import {
  clampProfileImagePosition,
  cropImageToSquare,
  loadImageElement,
  getProfileImageRenderedSize
} from "@/lib/image-crop";
import { cn } from "@/lib/utils";

type ProfileImageCropperProps = {
  open: boolean;
  imageSrc: string;
  fileName: string;
  onCancel: () => void;
  onError: (message: string) => void;
  onUsePhoto: (croppedPhoto: string) => void | Promise<void>;
};

type ImageSize = {
  width: number;
  height: number;
};

type CropPosition = {
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startPointerX: number;
  startPointerY: number;
  startPosition: CropPosition;
};

const DEFAULT_CROP_SIZE = 320;
const PREVIEW_SIZE = 96;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export function ProfileImageCropper({
  open,
  imageSrc,
  fileName,
  onCancel,
  onError,
  onUsePhoto
}: ProfileImageCropperProps) {
  const cropBoxRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const errorCallback=useRef(onError);errorCallback.current=onError;
  const applyLock=useRef(false),generation=useRef(0);
  const [loadError,setLoadError]=useState("");
  const [cropSize, setCropSize] = useState(DEFAULT_CROP_SIZE);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [position, setPosition] = useState<CropPosition>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [dragging, setDragging] = useState(false);
  const [applying, setApplying] = useState(false);

  const clampPosition = useCallback(
    (nextPosition: CropPosition, nextZoom = zoom) => {
      if (!imageSize) return { x: 0, y: 0 };

      return clampProfileImagePosition(nextPosition, {
        cropSize,
        naturalHeight: imageSize.height,
        naturalWidth: imageSize.width,
        zoom: nextZoom
      });
    },
    [cropSize, imageSize, zoom]
  );

  useEffect(() => {
    if (!open) return undefined;

    const cropBox = cropBoxRef.current;
    if (!cropBox) return undefined;

    const measureCropBox = () => {
      const width = cropBox.getBoundingClientRect().width;
      if (width > 0) setCropSize(width);
    };

    measureCropBox();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureCropBox);
      return () => window.removeEventListener("resize", measureCropBox);
    }

    const observer = new ResizeObserver(measureCropBox);
    observer.observe(cropBox);

    return () => observer.disconnect();
  }, [open,imageSrc]);

  useEffect(() => {
    const request=++generation.current,abort=new AbortController();
    dragRef.current=null;applyLock.current=false;
    setImageSize(null);setLoadError('');setPosition({x:0,y:0});setZoom(MIN_ZOOM);setDragging(false);setApplying(false);
    if(open&&imageSrc)void loadImageElement(imageSrc,abort.signal).then(image=>{
      if(request===generation.current&&!abort.signal.aborted)setImageSize({width:image.naturalWidth,height:image.naturalHeight});
    }).catch(error=>{if(!abort.signal.aborted&&request===generation.current){const message=error instanceof Error?error.message:'Could not decode this image. Choose another photo.';setLoadError(message);errorCallback.current(message);}});
    return()=>{generation.current=request+1;abort.abort();};
  },[imageSrc,open]);

  useEffect(() => {
    setPosition((current) => clampPosition(current, zoom));
  }, [clampPosition, cropSize, imageSize, zoom]);

  useEffect(() => {
    if (!open) return undefined;

    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape"&&!applyLock.current) onCancel();
    };

    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [onCancel, open]);

  const renderedSize = useMemo(() => {
    if (!imageSize) return null;

    return getProfileImageRenderedSize({
      cropSize,
      naturalHeight: imageSize.height,
      naturalWidth: imageSize.width,
      zoom
    });
  }, [cropSize, imageSize, zoom]);

  const imageStyle = useMemo(() => {
    if (!renderedSize) return undefined;

    return {
      height: renderedSize.baseHeight,
      marginLeft: -renderedSize.baseWidth / 2,
      marginTop: -renderedSize.baseHeight / 2,
      transform: `scale(${zoom})`,
      transformOrigin: "center center",
      width: renderedSize.baseWidth
    };
  }, [renderedSize, zoom]);

  const imageCenterStyle = useMemo(
    () => ({
      transform: `translate3d(${position.x}px, ${position.y}px, 0)`
    }),
    [position.x, position.y]
  );

  const previewScale = PREVIEW_SIZE / cropSize;
  const previewImageStyle = useMemo(() => {
    if (!renderedSize) return undefined;

    const baseWidth = renderedSize.baseWidth * previewScale;
    const baseHeight = renderedSize.baseHeight * previewScale;

    return {
      height: baseHeight,
      marginLeft: -baseWidth / 2,
      marginTop: -baseHeight / 2,
      transform: `scale(${zoom})`,
      transformOrigin: "center center",
      width: baseWidth
    };
  }, [previewScale, renderedSize, zoom]);

  const previewCenterStyle = useMemo(
    () => ({
      transform: `translate3d(${position.x * previewScale}px, ${position.y * previewScale}px, 0)`
    }),
    [position.x, position.y, previewScale]
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!imageSize || applying) return;

    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startPosition: position
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    event.preventDefault();
    const deltaX = event.clientX - drag.startPointerX;
    const deltaY = event.clientY - drag.startPointerY;
    const nextPosition = {
      x: drag.startPosition.x + deltaX,
      y: drag.startPosition.y + deltaY
    };

    setPosition(clampPosition(nextPosition, zoom));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;

    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const updateZoom = (value: string) => {
    const nextZoom = Math.min(Math.max(Number(value), MIN_ZOOM), MAX_ZOOM);
    setZoom(nextZoom);
    setPosition((current) => clampPosition(current, nextZoom));
  };

  const resetCrop = () => {
    setZoom(MIN_ZOOM);
    setPosition(clampPosition({ x: 0, y: 0 }, MIN_ZOOM));
  };

  const applyCrop = async () => {
    if (!imageSize) {
      return;
    }

    if(applyLock.current)return;applyLock.current=true;
    const request=generation.current;setApplying(true);
    try {
      const croppedPhoto = await cropImageToSquare(imageSrc, {
        cropSize,
        positionX: position.x,
        positionY: position.y,
        zoom
      });
      if(request===generation.current)await onUsePhoto(croppedPhoto);
    } catch {
      onError("Could not load this image. Try another photo.");
    }finally{applyLock.current=false;if(request===generation.current)setApplying(false);}
  };

  return (
    <Modal
      className="sm:max-w-xl"
      description="Adjust your photo so your face appears clearly in the circle."
      onClose={()=>{if(!applyLock.current)onCancel();}}
      open={open}
      title="Crop profile photo"
    >
      {loadError?<p role="alert" className="mb-3 text-sm text-red-600">{loadError} Cancel and choose another photo.</p>:!imageSize?<p role="status" className="mb-3 text-sm">Loading photo…</p>:null}
      <div className="grid gap-5 md:grid-cols-[1fr_120px]">
        <div className="space-y-4">
          <div
            aria-label="Profile photo crop area"
            className={cn(
              "relative mx-auto aspect-square w-full max-w-80 overflow-hidden rounded-full bg-slate-100 shadow-inner ring-2 ring-white",
              imageSize && !applying ? "cursor-grab" : "cursor-default",
              dragging ? "cursor-grabbing" : ""
            )}
            onKeyDown={event=>{if(!imageSize||applying)return;const step=event.shiftKey?20:10,delta:Record<string,[number,number]>={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};const move=delta[event.key];if(move){event.preventDefault();setPosition(current=>clampPosition({x:current.x+move[0],y:current.y+move[1]}));}}}
            onPointerCancel={endDrag}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            ref={cropBoxRef}
            role="application"
            style={{ touchAction: "none", userSelect: "none" }}
            tabIndex={0}
          >
            {imageSrc && imageStyle ? (
              <div
                className="pointer-events-none absolute left-1/2 top-1/2"
                style={imageCenterStyle}
              >
                <img
                  alt=""
                  className="max-w-none select-none"
                  draggable={false}
                  src={imageSrc}
                  style={imageStyle}
                />
              </div>
            ) : null}
            <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-inset ring-white/95" />
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-szocial-ink">Zoom</span>
            <input
              aria-label="Zoom profile photo"
              className="mt-2 h-2 w-full cursor-pointer accent-szocial-orange"
              disabled={!imageSize || applying}
              max={MAX_ZOOM}
              min={MIN_ZOOM}
              onChange={(event) => updateZoom(event.target.value)}
              step="0.01"
              type="range"
              value={zoom}
            />
          </label>
          <p className="truncate text-xs text-szocial-muted">{fileName}</p><p className="text-xs text-szocial-muted">Drag the photo or focus the crop area and use arrow keys to move it.</p>
        </div>
        <div className="flex flex-row items-center gap-4 md:flex-col md:items-start">
          <div>
            <p className="text-sm font-semibold text-szocial-ink">Preview</p>
            <div className="relative mt-2 h-24 w-24 overflow-hidden rounded-full bg-slate-100 ring-4 ring-szocial-orangeSoft">
              {imageSrc && previewImageStyle ? (
                <div
                  className="pointer-events-none absolute left-1/2 top-1/2"
                  style={previewCenterStyle}
                >
                  <img
                    alt="Cropped profile preview"
                    className="max-w-none select-none"
                    draggable={false}
                    src={imageSrc}
                    style={previewImageStyle}
                  />
                </div>
              ) : null}
            </div>
          </div>
          <Button
            className="shrink-0"
            disabled={!imageSize || applying}
            onClick={resetCrop}
            size="sm"
            variant="outline"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button disabled={applying} onClick={onCancel} variant="outline">
          Cancel
        </Button>
        <Button disabled={!imageSize || applying} onClick={applyCrop}>
          {applying ? "Cropping..." : "Use photo"}
        </Button>
      </div>
    </Modal>
  );
}
