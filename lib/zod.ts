import { z } from 'zod';
import {MAX_FILE_SIZE, isAcceptedBookFile, ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE} from './constants';

const isFile = (val: unknown): val is File => typeof File !== 'undefined' && val instanceof File;

export const UploadSchema = z.object({
    title: z.string().min(1, "Title is required").max(100, "Title is too long"),
    author: z.string().min(1, "Author name is required").max(100, "Author name is too long"),
    persona: z.string().min(1, "Please select a voice"),
    bookFile: z.any()
        .refine((file) => isFile(file), "Book file is required")
        .refine((file) => isFile(file) && file.size <= MAX_FILE_SIZE, "File size must be less than 50MB")
        .refine((file) => isFile(file) && isAcceptedBookFile(file), "Only PDF, EPUB and TXT files are accepted"),
    coverImage: z.any()
        .nullish()
        .refine((file) => !file || isFile(file), "Invalid file")
        .refine((file) => !file || (isFile(file) && file.size <= MAX_IMAGE_SIZE), "Image size must be less than 10MB")
        .refine((file) => !file || (isFile(file) && ACCEPTED_IMAGE_TYPES.includes(file.type)), "Only .jpg, .jpeg, .png and .webp formats are supported"),
});
