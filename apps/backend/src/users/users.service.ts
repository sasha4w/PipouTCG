import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // équivalent de User::findAll()
  findAll() {
    return this.userRepository.find();
  }

  // équivalent de User::find($id)
  findOne(id: number) {
    return this.userRepository.findOneBy({ id });
  }
  async findByEmail(email: string) {
    return this.userRepository.findOneBy({ email });
  }

  // équivalent de User::create()
  create(data: Partial<User>) {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }
}
