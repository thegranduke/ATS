import React, { useState } from "react";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Search, FileText, MessageCircle, Book, ChevronRight } from "lucide-react";

// Define support ticket schema
const supportTicketSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  category: z.string().min(1, "Please select a category"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  priority: z.string().min(1, "Please select a priority"),
});

// Help article type
type HelpArticle = {
  id: string;
  title: string;
  category: string;
  content: string;
  popular?: boolean;
};

// Help articles data - only keeping the Getting Started article
const helpArticles: HelpArticle[] = [
  {
    id: "1",
    title: "Getting Started with RecruitFlow",
    category: "Getting Started",
    content: "Learn how to set up your RecruitFlow account and get started with the basic features.",
    popular: true
  }
];

export default function HelpCenter() {
  const [activeTab, setActiveTab] = useState("articles");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);

  // Set up form for support ticket
  const form = useForm<z.infer<typeof supportTicketSchema>>({
    resolver: zodResolver(supportTicketSchema),
    defaultValues: {
      subject: "",
      category: "",
      description: "",
      priority: "",
    },
  });

  // Filter articles based on search query
  const filteredArticles = searchQuery 
    ? helpArticles.filter(article => 
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        article.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : helpArticles;

  // Get popular articles
  const popularArticles = helpArticles.filter(article => article.popular);

  // Handle form submission for support ticket
  function onSubmit(values: z.infer<typeof supportTicketSchema>) {
    // In a real application, this would send the ticket to a backend API
    console.log("Support ticket submitted:", values);
    
    toast({
      title: "Support ticket submitted",
      description: "We'll get back to you as soon as possible.",
    });
    
    form.reset();
  }

  return (
    <DashboardSidebar>
      <div className="px-4 sm:px-6 md:px-8 mt-6 md:mt-16">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Help Center</h1>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input 
              placeholder="Search help articles..." 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="mb-4">
            <TabsTrigger value="articles">Help Articles</TabsTrigger>
            <TabsTrigger value="support">Support Ticket</TabsTrigger>
          </TabsList>
          
          <TabsContent value="articles">
            {selectedArticle ? (
              <Card>
                <CardHeader className="border-b">
                  <div className="flex items-center gap-2 mb-2">
                    <button 
                      onClick={() => setSelectedArticle(null)}
                      className="text-sm text-blue-600 hover:underline flex items-center"
                    >
                      Back to Articles
                    </button>
                  </div>
                  <CardTitle className="text-2xl">{selectedArticle.title}</CardTitle>
                  <CardDescription>Category: {selectedArticle.category}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="prose max-w-none">
                    <p className="text-gray-700 leading-relaxed">{selectedArticle.content}</p>
                    {/* In a real app, this would be formatted content with sections, images, etc. */}
                    <div className="mt-8 p-4 bg-blue-50 rounded-md">
                      <h3 className="text-lg font-medium text-blue-800 mb-2">Was this article helpful?</h3>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">Yes</Button>
                        <Button variant="outline" size="sm">No</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {searchQuery === "" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Popular Articles</CardTitle>
                      <CardDescription>Most frequently viewed help articles</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-3">
                        {popularArticles.map((article) => (
                          <Card 
                            key={article.id} 
                            className="cursor-pointer hover:border-blue-400 transition-colors"
                            onClick={() => setSelectedArticle(article)}
                          >
                            <CardHeader className="p-4">
                              <FileText className="h-8 w-8 text-blue-500 mb-2" />
                              <CardTitle className="text-lg">{article.title}</CardTitle>
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>{searchQuery ? "Search Results" : "All Help Articles"}</CardTitle>
                    {searchQuery && (
                      <CardDescription>Showing results for "{searchQuery}"</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {filteredArticles.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No articles found. Try a different search term.</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredArticles.map((article) => (
                          <div 
                            key={article.id}
                            onClick={() => setSelectedArticle(article)}
                            className="flex items-center justify-between p-3 rounded-md cursor-pointer hover:bg-gray-100"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-gray-400" />
                              <div>
                                <h3 className="font-medium">{article.title}</h3>
                                <p className="text-sm text-gray-500">{article.category}</p>
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="support">
            <Card>
              <CardHeader>
                <CardTitle>Submit a Support Ticket</CardTitle>
                <CardDescription>
                  Need help with something specific? Our support team is here to help.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter a subject" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="account">Account Issues</SelectItem>
                                <SelectItem value="billing">Billing & Payments</SelectItem>
                                <SelectItem value="jobs">Job Management</SelectItem>
                                <SelectItem value="candidates">Candidate Management</SelectItem>
                                <SelectItem value="technical">Technical Issues</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe your issue in detail..." 
                              className="min-h-[150px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Include any relevant details that might help us resolve your issue quickly.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button type="submit" className="w-full md:w-auto">
                      Submit Ticket
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardSidebar>
  );
}