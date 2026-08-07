import React from "react";
import { useCachedMedia } from "../lib/mediaCache";
import { handleImageError, DEFAULT_IMAGE_PLACEHOLDER } from "../lib/utils";

export interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  fallbackUrl?: string;
}

export const CachedImage: React.FC<CachedImageProps> = ({
  src,
  alt = "Image",
  fallbackUrl = DEFAULT_IMAGE_PLACEHOLDER,
  className = "",
  onError,
  ...props
}) => {
  const { cachedUrl } = useCachedMedia(src);

  return (
    <img
      src={cachedUrl || fallbackUrl}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={(e) => {
        handleImageError(e, fallbackUrl);
        if (onError) onError(e);
      }}
      {...props}
    />
  );
};
