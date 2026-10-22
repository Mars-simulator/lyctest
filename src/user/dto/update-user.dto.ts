// src/user/dto/update-user.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto.js';

// PartialType：继承CreateUserDto，所有字段变为可选
export class UpdateUserDto extends PartialType(CreateUserDto) {}
