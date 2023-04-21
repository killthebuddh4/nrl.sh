create table "public"."knowledge_embeddings" (
    "id" uuid not null,
    "created_at" timestamp with time zone not null,
    "embedding" vector(1536) not null,
    "question_completion_id" uuid not null
);


alter table "public"."query_embeddings" drop column "query_text";

alter table "public"."query_embeddings" add column "text" text not null;

CREATE UNIQUE INDEX knowledge_embeddings_pkey ON public.knowledge_embeddings USING btree (id);

alter table "public"."knowledge_embeddings" add constraint "knowledge_embeddings_pkey" PRIMARY KEY using index "knowledge_embeddings_pkey";

alter table "public"."knowledge_embeddings" add constraint "knowledge_embeddings_question_completion_id_fkey" FOREIGN KEY (question_completion_id) REFERENCES question_completions(id) ON DELETE CASCADE not valid;

alter table "public"."knowledge_embeddings" validate constraint "knowledge_embeddings_question_completion_id_fkey";


