import express from 'express';
import { prisma } from '../utils/index.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

//게시글 등록
router.post(
	'/community/:communityId',

	async (req, res, next) => {
		const { communityId } = req.params;
		// const { userId } = req.user;
		const { title, content } = req.body;

		//유저가 커뮤니티에 속해있으면 작성 아니면 모임가입필요

		// const isCommunityUser = await prisma.communityUsers.findfirst({
		//   where: {
		//     userId: +userId,
		//     communityId: +communityId,
		//   },
		// });

		// if (isCommunityUser) {
		//   const post = await prisma.posts.create({
		//     data: {
		//       userId: +userId,
		//       communityId: +communityId,
		//       title: title,
		//       content: content,
		//     },
		//   });
		// } else {
		//   return res
		//     .status(403)
		//     .json({ message: "모임에 가입한 사람만 글을 작성할 수 있습니다." });
		// }

		const dd = await prisma.posts.create({
			data: {
				communityId: +communityId,
				title: title,
				content: content,
				userId: 1,
			},
		});

		return res.status(201).json({ message: '작성완료' });
	},
);

// 게시글 수정
// localhost:3000/api/:communityId/:postId
router.patch(
	'/:communityId/:postId',

	async (req, res, next) => {
		const { communityId, postId } = req.params;
		const { userId } = req.user;
		const { title, content } = req.body;

		// 자기 글인지 확인
		const isMyPost = await prisma.posts.findFirst({
			where: {
				communityId: +communityId,
				id: +postId,
			},
			select: {
				userId: true,
			},
		});

		if (!isMyPost) {
			return res.status(404).json({ message: '해당 글을 찾을 수 없습니다.' });
		}

		// if (isMyPost.userId !== userId) {
		//   return res
		//     .status(403)
		//     .json({ message: "본인의 글만 수정할 수 있습니다." });
		// }

		const updatePost = await prisma.posts.update({
			where: {
				id: +postId,
				communityId: +communityId,
				userId: +userId,
			},
			data: {
				title: title,
				content: content,
			},
		});
		return res.status(200).json({ message: '수정 완료' });
	},
);

// 게시글 삭제
//localhost:3000/api/:communityId/:postId
router.delete(
	'/:communityId/:postId',
	async (req, res, next) => {
		const { communityId, postId } = req.params;
		const { userId } = req.user;

		// 자기 글인지 확인
		const isMyPost = await prisma.posts.findFirst({
			where: {
				communityId: +communityId,
				id: +postId,
			},
			select: {
				userId: true,
			},
		});

		if (!isMyPost) {
			return res.status(404).json({ message: '해당 글을 찾을 수 없습니다.' });
		}

		if (isMyPost.userId !== userId) {
			return res
				.status(403)
				.json({ message: '본인의 글만 삭제할 수 있습니다.' });
		}

		await prisma.posts.delete({
			where: {
				communityId: +communityId,
				id: +postId,
				userId: +userId,
			},
		});
		return res.status(204).json({ message: '삭제완료' });
	},
);

/**
 * 댓글 등록
 */
router.post('/comment/:parentsId', async (req, res, next) => {
	const { content } = req.body;
	const { parentsId } = req.params;
	//const loginId = req.user.userId;
	const loginId = 1;

	if (!loginId) {
		return res.status(401).json({ message: '작성자 정보를 찾을 수 없습니다.' });
	}

	if (!parentsId) {
		return res.status(401).json({ message: '원글을 찾을 수 없습니다.' });
	}
	if (!content) {
		return res.status(401).json({ message: '댓글 내용을 입력하세요.' });
	}

	const postCommunity = await prisma.posts.findFirst({
		where: {
			id: +parentsId,
			isComment: false,
		},
	});

	if (!postCommunity) {
		return res
			.status(409)
			.json({ message: '존재하지 않는 커뮤니티의 게시글입니다.' });
	}

	try {
		const communityId = postCommunity.communityId;
		const comment = await prisma.posts.create({
			data: {
				userId: +loginId,
				communityId,
				title: '댓글',
				content,
				isComment: true,
                parentsId:+parentsId,
			},
		});

		return res.status(201).json({ message: '댓글이 정상 등록되었습니다.' });
	} catch (error) {
		return res
			.status(500)
			.json({ message: '서버 오류가 발생했습니다.', error: error.message });
	}
});
/**
 * 댓글 수정
 */
router.patch('/comment/:postId', async (req, res, next) => {
	const { postId } = req.params;
	const { content } = req.body;

	//const loginId = req.user.userId;
	const loginId = 1;

	try {
		const existingComment = await prisma.posts.findUnique({
			where: {
				id: +postId,
				isComment: true,
			},
		});

		if (!existingComment) {
			return res
				.status(404)
				.json({ message: '해당 댓글 조회에 실패하였습니다.' });
		}

		if (existingComment.userId !== loginId) {
			return res
				.status(404)
				.json({ message: '본인의 댓글만 수정하실 수 있습니다.' });
		}

		const updatedComment = await prisma.posts.update({
			where: { id: +postId },
			data: {
				...(content && { content }),
			},
		});

		return res.status(200).json({
			message: '댓글이 정상 수정되었습니다.',
			resume: updatedComment,
		});
	} catch (error) {
		return res
			.status(500)
			.json({ message: '서버 오류가 발생했습니다.', error: error.message });
	}
});

/**
 * 댓글 조회
 */
router.get('/comment/:parentsId', async (req, res, next) => {
	const { orderKey, orderValue } = req.query;
	const validOrderValue =
		orderValue && orderValue.toUpperCase() === 'ASC' ? 'asc' : 'desc';
    const { parentsId } = req.params;

	try {
		let query = {
			select: {
				content: true,
				createdAt: true,
				updatedAt: true,
				user: {
					select: {
						name : true,
					},
				},
			},
            where : {
                parentsId : +parentsId,
                isComment : true,
            },
			orderBy: {
				[orderKey || 'createdAt']: validOrderValue,
			},
		};

		const comments = await prisma.posts.findMany(query);
		return res.status(200).json({ data: comments });
	} catch (error) {
		return res
			.status(500)
			.json({ message: '서버 오류가 발생했습니다.', error: error.message });
	}
});

export default router;
